import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PLAN_MAX_TOURNAMENTS } from '../clubs/clubs.service';
import { withSubscriptionLifecycleLock } from '../common/prisma/subscription-lifecycle-lock';
import { runSerializable } from '../common/prisma/serializable';
import { PrismaService } from '../prisma/prisma.service';
import type { MercadoPagoWebhookDto } from './dto/mercado-pago-webhook.dto';
import {
  MERCADO_PAGO_PREAPPROVAL_CLIENT,
  ProviderUnavailableError,
} from './mercado-pago-preapproval.client';
import type {
  AuthorizedPayment,
  MercadoPagoPreapprovalClient,
} from './mercado-pago-preapproval.client';
import { MERCADO_PAGO_WEBHOOK_VERIFIER } from './mercado-pago-webhook-verifier';
import type { MercadoPagoWebhookVerifier } from './mercado-pago-webhook-verifier';
import { SubscriptionUpgradeService } from './subscription-upgrade.service';

const CHARGE_NOTIFICATION_TYPE = 'subscription_authorized_payment';

@Injectable()
export class MercadoPagoWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MERCADO_PAGO_PREAPPROVAL_CLIENT)
    private readonly mercadoPago: MercadoPagoPreapprovalClient,
    @Inject(MERCADO_PAGO_WEBHOOK_VERIFIER)
    private readonly verifier: MercadoPagoWebhookVerifier,
    @Optional() private readonly upgrades?: SubscriptionUpgradeService,
  ) {}

  async receive(
    payload: MercadoPagoWebhookDto,
    signature: string | undefined,
    requestId: string | undefined,
    queryDataId: string | undefined = payload.data.id,
  ): Promise<void> {
    // Mercado Pago signs the query parameter. Requiring it to agree with the
    // body binds that signed routing identity to the resource we retrieve.
    if (
      !signature ||
      !requestId ||
      !queryDataId ||
      queryDataId !== payload.data.id ||
      !this.verifier.verify({ signature, requestId, dataId: queryDataId })
    ) {
      throw new UnauthorizedException({
        code: 'invalid_webhook_signature',
        message: 'webhook signature is invalid',
      });
    }

    const event = await this.persistOrGetEvent(payload);
    if (event.processedAt) return;
    if (payload.type === 'payment') {
      if (!this.upgrades) throw this.providerUnavailable();
      await this.upgrades.processPaymentEvent(event.id, payload.data.id);
      return;
    }
    if (payload.type !== CHARGE_NOTIFICATION_TYPE) {
      await this.markProcessed(event.id);
      return;
    }
    await this.processAuthorizedPayment(event.id, payload.data.id);
  }

  /** Worker boundary for outages and notifications that outran durable state. */
  async reconcilePendingAuthorizedPayments(limit = 100): Promise<number> {
    const events = await this.prisma.paymentEvent.findMany({
      where: {
        provider: 'mercado_pago',
        type: CHARGE_NOTIFICATION_TYPE,
        processedAt: null,
      },
      orderBy: { receivedAt: 'asc' },
      take: limit,
      select: { id: true, resourceId: true },
    });
    let reconciled = 0;
    for (const event of events) {
      try {
        await this.processAuthorizedPayment(event.id, event.resourceId);
        reconciled += 1;
      } catch (error) {
        if (!(error instanceof ServiceUnavailableException)) throw error;
      }
    }
    return reconciled;
  }

  async reconcilePendingUpgradePayments(limit = 100): Promise<number> {
    if (!this.upgrades) return 0;
    const events = await this.prisma.paymentEvent.findMany({
      where: { provider: 'mercado_pago', type: 'payment', processedAt: null },
      orderBy: { receivedAt: 'asc' },
      take: limit,
      select: { id: true, resourceId: true },
    });
    let reconciled = 0;
    for (const event of events) {
      try {
        await this.upgrades.processPaymentEvent(event.id, event.resourceId);
        reconciled += 1;
      } catch (error) {
        if (!(error instanceof ServiceUnavailableException)) throw error;
      }
    }
    return reconciled;
  }

  /**
   * Recovers onboarding checkouts whose provider invoice was paid but whose
   * notification never reached us. This deliberately never creates a webhook
   * receipt: the same canonical correlation and idempotent settlement are
   * applied directly to the durable checkout.
   */
  async reconcilePendingCheckoutsWithoutPaymentEvents(
    limit = 100,
  ): Promise<number> {
    if (!this.mercadoPago.findAuthorizedPaymentsByPreapproval) return 0;
    const half = Math.max(1, Math.ceil(limit / 2));
    // A two-sided bounded window preserves oldest-first recovery while making
    // progress on newer payments if old provider lookups remain unavailable.
    const where = {
      provider: 'mercado_pago' as const,
      state: 'pending' as const,
      providerPreapprovalId: { not: null },
    };
    const select = { id: true, providerPreapprovalId: true };
    const [oldest, newest] = await Promise.all([
      this.prisma.subscriptionCheckout.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: half,
        select,
      }),
      this.prisma.subscriptionCheckout.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: half,
        select,
      }),
    ]);
    let reconciled = 0;
    for (const checkout of new Map(
      [...oldest, ...newest].map((item) => [item.id, item]),
    ).values()) {
      try {
        const payments: AuthorizedPayment[] =
          await this.mercadoPago.findAuthorizedPaymentsByPreapproval(
            checkout.providerPreapprovalId!,
          );
        for (const payment of payments) {
          if (
            payment.preapprovalId !== checkout.providerPreapprovalId ||
            payment.paymentStatus !== 'approved'
          )
            continue;
          // If a signed notification was persisted, its normal retry path is
          // authoritative; recovery must not race it or invent a new event.
          const event = await this.prisma.paymentEvent.findFirst({
            where: {
              provider: 'mercado_pago',
              type: CHARGE_NOTIFICATION_TYPE,
              resourceId: payment.id,
            },
            select: { id: true },
          });
          if (event) continue;
          if (await this.reconcilePendingCheckout(checkout.id, payment)) {
            reconciled += 1;
            break;
          }
        }
      } catch {
        // Individual provider and transaction failures must not starve other
        // pending checkouts in this bounded run.
      }
    }
    return reconciled;
  }

  /**
   * A paused mandate has no future renewal, so expiry is the point where it is
   * safely cancelled and forgotten locally. Provider work happens first: an
   * outage must retain the paid entitlement and retry on the next lease run.
   */
  async finalizeExpiredPausedSubscriptions(
    now = new Date(),
    limit = 100,
  ): Promise<number> {
    if (!this.mercadoPago.cancelPreapproval) return 0;
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        providerStatus: 'paused',
        providerPreapprovalId: { not: null },
        currentPeriodEndsAt: { lte: now },
      },
      orderBy: [{ currentPeriodEndsAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { id: true, providerPreapprovalId: true },
    });
    let finalized = 0;
    for (const subscription of subscriptions) {
      const preapprovalId = subscription.providerPreapprovalId!;
      try {
        // The scan is only a candidate list. Re-read immediately before the
        // irreversible provider call so a resume that committed after the
        // scan cannot have its mandate cancelled from stale data.
        const currentBeforeProvider = await this.prisma.subscription.findUnique(
          {
            where: { id: subscription.id },
            select: {
              providerPreapprovalId: true,
              providerStatus: true,
              currentPeriodEndsAt: true,
            },
          },
        );
        if (
          !currentBeforeProvider ||
          currentBeforeProvider.providerPreapprovalId !== preapprovalId ||
          currentBeforeProvider.providerStatus !== 'paused' ||
          !currentBeforeProvider.currentPeriodEndsAt ||
          currentBeforeProvider.currentPeriodEndsAt > now
        )
          continue;
        // Provider work is intentionally outside the DB transaction. A lost
        // response is resolved by a canonical read before local finalization.
        try {
          await this.mercadoPago.cancelPreapproval(preapprovalId);
        } catch {
          const canonical =
            await this.mercadoPago.getPreapproval(preapprovalId);
          if (
            canonical.id !== preapprovalId ||
            canonical.status !== 'cancelled'
          )
            throw new ProviderUnavailableError();
        }
        const result = await withSubscriptionLifecycleLock(
          this.prisma,
          subscription.id,
          async (tx) => {
            const current = await tx.subscription.findUniqueOrThrow({
              where: { id: subscription.id },
              select: {
                providerPreapprovalId: true,
                providerStatus: true,
                currentPeriodEndsAt: true,
              },
            });
            if (
              current.providerPreapprovalId !== preapprovalId ||
              current.providerStatus !== 'paused' ||
              !current.currentPeriodEndsAt ||
              current.currentPeriodEndsAt > now
            )
              return false;
            await tx.subscriptionPreapprovalTombstone.upsert({
              where: {
                provider_providerPreapprovalId: {
                  provider: 'mercado_pago',
                  providerPreapprovalId: preapprovalId,
                },
              },
              create: {
                provider: 'mercado_pago',
                providerPreapprovalId: preapprovalId,
                subscriptionId: subscription.id,
              },
              update: {},
            });
            await tx.subscription.update({
              where: { id: subscription.id },
              data: {
                plan: 'free',
                status: 'canceled',
                maxTournaments: PLAN_MAX_TOURNAMENTS.free,
                providerPreapprovalId: null,
                providerStatus: 'cancelled',
                pausedAt: null,
                currentPeriodEndsAt: null,
                pendingPlan: null,
                pendingPlanAmount: null,
                pendingPlanCurrency: null,
                pendingPlanConfirmedAt: null,
                pendingPlanEffectiveAt: null,
                pendingPlanPaidAt: null,
              },
            });
            return true;
          },
        );
        if (result) finalized += 1;
      } catch {
        // A provider failure keeps the mandate and entitlement intact so the
        // next leased run can retry without inventing a local cancellation.
      }
    }
    return finalized;
  }

  /**
   * A missing renewal webhook is not proof that a mandate failed. Before
   * downgrading an expired active mandate, read the provider's invoices and
   * settle a newer approved one under the same lifecycle lock as webhooks.
   */
  async reconcileExpiredActiveSubscriptions(
    now = new Date(),
    limit = 100,
  ): Promise<number> {
    if (!this.mercadoPago.findAuthorizedPaymentsByPreapproval) return 0;
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        providerStatus: { not: 'paused' },
        providerPreapprovalId: { not: null },
        currentPeriodEndsAt: { lte: now },
      },
      orderBy: [{ currentPeriodEndsAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { id: true, providerPreapprovalId: true },
    });
    let settledOrExpired = 0;
    for (const candidate of subscriptions) {
      try {
        const payments =
          await this.mercadoPago.findAuthorizedPaymentsByPreapproval(
            candidate.providerPreapprovalId!,
          );
        const newestApproved = payments
          .filter(
            (payment) =>
              payment.preapprovalId === candidate.providerPreapprovalId &&
              payment.paymentStatus === 'approved',
          )
          .sort(
            (left, right) => right.paidAt.getTime() - left.paidAt.getTime(),
          )[0];
        const changed = await withSubscriptionLifecycleLock(
          this.prisma,
          candidate.id,
          async (tx) => {
            const current = await tx.subscription.findUniqueOrThrow({
              where: { id: candidate.id },
              select: {
                providerPreapprovalId: true,
                providerStatus: true,
                currentPeriodEndsAt: true,
                plan: true,
                pendingPlan: true,
                pendingPlanAmount: true,
                pendingPlanCurrency: true,
                pendingPlanEffectiveAt: true,
                pendingPlanPaidAt: true,
              },
            });
            if (
              current.providerPreapprovalId !==
                candidate.providerPreapprovalId ||
              current.providerStatus === 'paused' ||
              !current.currentPeriodEndsAt ||
              current.currentPeriodEndsAt > now
            )
              return false;
            if (
              newestApproved &&
              addOneMonth(newestApproved.paidAt) > current.currentPeriodEndsAt
            ) {
              await this.applyApprovedEntitlement(tx, newestApproved, null, {
                id: candidate.id,
                plan: current.plan,
                currentPeriodEndsAt: current.currentPeriodEndsAt,
                pendingPlan: current.pendingPlan,
                pendingPlanAmount: current.pendingPlanAmount,
                pendingPlanCurrency: current.pendingPlanCurrency,
                pendingPlanEffectiveAt: current.pendingPlanEffectiveAt,
                pendingPlanPaidAt: current.pendingPlanPaidAt,
              });
              return true;
            }
            await tx.subscription.update({
              where: { id: candidate.id },
              data: {
                plan: 'free',
                status: 'canceled',
                maxTournaments: PLAN_MAX_TOURNAMENTS.free,
                currentPeriodEndsAt: null,
                pendingPlan: null,
                pendingPlanAmount: null,
                pendingPlanCurrency: null,
                pendingPlanConfirmedAt: null,
                pendingPlanEffectiveAt: null,
                pendingPlanPaidAt: null,
              },
            });
            return true;
          },
        );
        if (changed) settledOrExpired += 1;
      } catch {
        // A canonical read failure is ambiguous. Keep access and retry.
      }
    }
    return settledOrExpired;
  }

  /** No grace period beyond the paid period; invoke from the scheduled worker. */
  async expirePastDueEntitlements(now = new Date()): Promise<number> {
    const result = await this.prisma.subscription.updateMany({
      // Paused mandates use finalizeExpiredPausedSubscriptions so their
      // tombstone and provider cancellation are both durable before downgrade.
      where: {
        // An active mandate can be in the small provider-to-database pause
        // window. Only a known failed mandate or a subscription without a
        // mandate may use this generic downgrade path.
        OR: [
          { status: 'past_due' },
          { status: 'active', providerPreapprovalId: null },
        ],
        currentPeriodEndsAt: { lte: now },
      },
      data: {
        plan: 'free',
        status: 'canceled',
        maxTournaments: PLAN_MAX_TOURNAMENTS.free,
        currentPeriodEndsAt: null,
        pendingPlan: null,
        pendingPlanAmount: null,
        pendingPlanCurrency: null,
        pendingPlanConfirmedAt: null,
        pendingPlanEffectiveAt: null,
        pendingPlanPaidAt: null,
      },
    });
    return result.count;
  }

  async activatePaidDowngrades(now = new Date(), limit = 100): Promise<number> {
    const candidates = await this.prisma.subscription.findMany({
      where: {
        plan: 'pro',
        status: 'active',
        pendingPlan: 'basic',
        pendingPlanPaidAt: { not: null },
        pendingPlanEffectiveAt: { lte: now },
        currentPeriodEndsAt: { gt: now },
      },
      orderBy: { pendingPlanEffectiveAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    let activated = 0;
    for (const candidate of candidates) {
      const changed = await withSubscriptionLifecycleLock(
        this.prisma,
        candidate.id,
        async (tx) => {
          const current = await tx.subscription.findUniqueOrThrow({
            where: { id: candidate.id },
          });
          if (
            current.plan !== 'pro' ||
            current.status !== 'active' ||
            current.pendingPlan !== 'basic' ||
            !current.pendingPlanPaidAt ||
            !current.pendingPlanEffectiveAt ||
            current.pendingPlanEffectiveAt > now ||
            !current.currentPeriodEndsAt ||
            current.currentPeriodEndsAt <= now
          )
            return false;
          await tx.subscription.update({
            where: { id: current.id },
            data: {
              plan: 'basic',
              maxTournaments: PLAN_MAX_TOURNAMENTS.basic,
              pendingPlan: null,
              pendingPlanAmount: null,
              pendingPlanCurrency: null,
              pendingPlanConfirmedAt: null,
              pendingPlanEffectiveAt: null,
              pendingPlanPaidAt: null,
            },
          });
          return true;
        },
      );
      if (changed) activated += 1;
    }
    return activated;
  }

  private async processAuthorizedPayment(
    eventId: string,
    resourceId: string,
  ): Promise<void> {
    let payment: AuthorizedPayment;
    try {
      payment = await this.mercadoPago.getAuthorizedPayment(resourceId);
    } catch (error) {
      if (error instanceof ProviderUnavailableError) {
        await this.markRetryable(eventId);
        throw this.providerUnavailable();
      }
      throw error;
    }
    if (payment.id !== resourceId) {
      await this.markProcessed(eventId);
      return;
    }

    const lookup = this.prisma.subscription
      ? await this.prisma.subscription.findFirst({
          where: { providerPreapprovalId: payment.preapprovalId },
          select: { id: true },
        })
      : null;
    // Provider I/O happened before this point. The lifecycle transaction only
    // serializes durable settlement with cancel/resume/finalize; it never
    // keeps a Prisma transaction open across the 10s provider timeout.
    const settle = async (tx: Prisma.TransactionClient) => {
      const event = await tx.paymentEvent.findUniqueOrThrow({
        where: { id: eventId },
      });
      if (event.processedAt) return 'processed' as const;
      const checkout = await tx.subscriptionCheckout.findFirst({
        where: {
          provider: 'mercado_pago',
          providerPreapprovalId: payment.preapprovalId,
        },
      });
      const subscription = await tx.subscription.findFirst({
        where: { providerPreapprovalId: payment.preapprovalId },
      });
      const tombstone = subscription
        ? null
        : await tx.subscriptionPreapprovalTombstone.findUnique({
            where: {
              provider_providerPreapprovalId: {
                provider: 'mercado_pago',
                providerPreapprovalId: payment.preapprovalId,
              },
            },
          });

      if (payment.paymentStatus !== 'approved') {
        const terminalFailure = isTerminalPaymentFailure(payment);
        const matchesPendingOnboardingCheckout =
          terminalFailure &&
          !subscription &&
          checkout &&
          checkout.state === 'pending' &&
          checkout.amount.equals(new Prisma.Decimal(payment.amount)) &&
          checkout.currency === payment.currencyId &&
          checkout.reference === payment.externalReference;
        if (
          subscription &&
          terminalFailure &&
          subscription.providerStatus !== 'paused'
        ) {
          await tx.subscription.update({
            where: { id: subscription.id },
            data: { status: 'past_due', providerStatus: payment.invoiceStatus },
          });
        }
        // Mercado Pago can cancel a preapproval after its first charge is
        // rejected. Its stored init point is then permanently unusable, so a
        // correlated onboarding checkout must no longer block a fresh one.
        if (matchesPendingOnboardingCheckout) {
          await tx.subscriptionCheckout.update({
            where: { id: checkout.id },
            data: { state: 'expired', providerStatus: payment.invoiceStatus },
          });
        }
        await tx.paymentEvent.update({
          where: { id: event.id },
          data: terminalFailure
            ? {
                processedAt: new Date(),
                subscriptionId:
                  subscription?.id ??
                  (matchesPendingOnboardingCheckout
                    ? checkout.subscriptionId
                    : undefined),
              }
            : { lastErrorAt: new Date() },
        });
        return terminalFailure
          ? ('processed' as const)
          : ('retryable' as const);
      }

      // A pause stops future renewal. An invoice that was paid before the
      // durable pause boundary still earns its period, while a later invoice
      // is auditable but cannot resurrect or extend the paused mandate.
      if (subscription?.providerStatus === 'paused') {
        const paidBeforePause =
          !subscription.pausedAt || payment.paidAt <= subscription.pausedAt;
        if (paidBeforePause) {
          await this.applyApprovedEntitlement(
            tx,
            payment,
            checkout,
            subscription,
            {
              keepPaused: true,
            },
          );
        }
        await tx.paymentEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date(), subscriptionId: subscription.id },
        });
        return 'processed' as const;
      }

      const expectedCheckout =
        checkout &&
        checkout.state === 'pending' &&
        checkout.amount.equals(new Prisma.Decimal(payment.amount)) &&
        checkout.currency === payment.currencyId &&
        checkout.reference === payment.externalReference;
      const expectedRenewal =
        subscription &&
        subscription.providerPreapprovalId === payment.preapprovalId;
      if (!expectedCheckout && !expectedRenewal) {
        if (tombstone) {
          await tx.paymentEvent.update({
            where: { id: event.id },
            data: {
              processedAt: new Date(),
              subscriptionId: tombstone.subscriptionId,
            },
          });
          return 'processed' as const;
        }
        // Do not permanently acknowledge an event that can be retried after a
        // checkout recovery finishes.
        await tx.paymentEvent.update({
          where: { id: event.id },
          data: { lastErrorAt: new Date() },
        });
        return 'retryable' as const;
      }

      const subscriptionId = await this.applyApprovedEntitlement(
        tx,
        payment,
        checkout,
        subscription,
      );
      await tx.paymentEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date(), subscriptionId },
      });
      return 'processed' as const;
    };
    const outcome = lookup
      ? await withSubscriptionLifecycleLock(this.prisma, lookup.id, settle)
      : await runSerializable(this.prisma, settle);
    if (outcome === 'retryable') throw this.providerUnavailable();
  }

  private async reconcilePendingCheckout(
    checkoutId: string,
    payment: AuthorizedPayment,
  ): Promise<boolean> {
    return runSerializable(this.prisma, async (tx) => {
      const checkout = await tx.subscriptionCheckout.findUniqueOrThrow({
        where: { id: checkoutId },
      });
      if (
        checkout.provider !== 'mercado_pago' ||
        checkout.providerPreapprovalId !== payment.preapprovalId
      )
        return false;
      const existingEvent = await tx.paymentEvent.findFirst({
        where: {
          provider: 'mercado_pago',
          type: CHARGE_NOTIFICATION_TYPE,
          resourceId: payment.id,
        },
        select: { id: true },
      });
      if (existingEvent) return false;
      const subscription = await tx.subscription.findUniqueOrThrow({
        where: { id: checkout.subscriptionId },
      });
      if (
        checkout.state !== 'pending' ||
        !checkout.amount.equals(new Prisma.Decimal(payment.amount)) ||
        checkout.currency !== payment.currencyId ||
        checkout.reference !== payment.externalReference
      )
        return false;
      await this.applyApprovedEntitlement(tx, payment, checkout, subscription);
      return true;
    });
  }

  private async applyApprovedEntitlement(
    tx: Prisma.TransactionClient,
    payment: AuthorizedPayment,
    checkout: {
      id: string;
      subscriptionId: string;
      targetPlan: 'free' | 'basic' | 'pro';
    } | null,
    subscription: {
      id: string;
      plan: 'free' | 'basic' | 'pro';
      currentPeriodEndsAt: Date | null;
      providerStatus?: string | null;
      pausedAt?: Date | null;
      pendingPlan?: 'free' | 'basic' | 'pro' | null;
      pendingPlanAmount?: { equals(value: Prisma.Decimal): boolean } | null;
      pendingPlanCurrency?: string | null;
      pendingPlanEffectiveAt?: Date | null;
      pendingPlanPaidAt?: Date | null;
      currentPeriodStartedAt?: Date | null;
      currentPeriodAmount?: { toFixed(digits: number): string } | null;
    } | null,
    options: { keepPaused?: boolean } = {},
  ): Promise<string> {
    const subscriptionId = checkout
      ? checkout.subscriptionId
      : subscription!.id;
    const paidThrough = addOneMonth(payment.paidAt);
    const currentPeriodEndsAt = subscription?.currentPeriodEndsAt;
    const appliesPendingDowngrade =
      !checkout &&
      subscription?.plan === 'pro' &&
      subscription.pendingPlan === 'basic' &&
      subscription.pendingPlanEffectiveAt != null &&
      currentPeriodEndsAt !== null &&
      currentPeriodEndsAt !== undefined &&
      paidThrough > currentPeriodEndsAt &&
      subscription.pendingPlanAmount?.equals(
        new Prisma.Decimal(payment.amount),
      ) === true &&
      subscription.pendingPlanCurrency === payment.currencyId;
    const activatesDowngradeNow =
      appliesPendingDowngrade &&
      payment.paidAt >= subscription.pendingPlanEffectiveAt!;
    const targetPlan = checkout
      ? checkout.targetPlan
      : activatesDowngradeNow
        ? 'basic'
        : subscription!.plan;
    const effectivePeriodEndsAt =
      currentPeriodEndsAt && currentPeriodEndsAt > paidThrough
        ? currentPeriodEndsAt
        : paidThrough;
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        plan: targetPlan,
        status: 'active',
        maxTournaments: PLAN_MAX_TOURNAMENTS[targetPlan],
        providerPreapprovalId: payment.preapprovalId,
        providerStatus: options.keepPaused ? 'paused' : payment.invoiceStatus,
        pausedAt: options.keepPaused ? subscription?.pausedAt : null,
        currentPeriodEndsAt: effectivePeriodEndsAt,
        ...(paidThrough > (currentPeriodEndsAt ?? new Date(0))
          ? {
              currentPeriodStartedAt: payment.paidAt,
              currentPeriodAmount: new Prisma.Decimal(payment.amount),
              currentPeriodCurrency: payment.currencyId,
            }
          : {}),
        ...(appliesPendingDowngrade && !activatesDowngradeNow
          ? { pendingPlanPaidAt: payment.paidAt }
          : {}),
        ...(activatesDowngradeNow
          ? {
              pendingPlan: null,
              pendingPlanAmount: null,
              pendingPlanCurrency: null,
              pendingPlanConfirmedAt: null,
              pendingPlanEffectiveAt: null,
              pendingPlanPaidAt: null,
            }
          : {}),
      },
    });
    if (checkout) {
      await tx.subscriptionCheckout.update({
        where: { id: checkout.id },
        data: { state: 'completed', providerStatus: payment.invoiceStatus },
      });
    }
    return subscriptionId;
  }

  private providerUnavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'billing_provider_unavailable',
      message: 'billing provider is unavailable',
    });
  }

  private async persistOrGetEvent(payload: MercadoPagoWebhookDto) {
    const existing = await this.prisma.paymentEvent.findUnique({
      where: {
        provider_externalId: {
          provider: 'mercado_pago',
          externalId: payload.id,
        },
      },
    });
    if (existing) {
      if (
        existing.type !== payload.type ||
        existing.resourceId !== payload.data.id ||
        // Prisma reads a missing optional string back as null while DTO input
        // represents it as undefined. They are the same signed event shape.
        existing.action !== (payload.action ?? null)
      ) {
        throw new BadRequestException({
          code: 'webhook_event_identity_conflict',
          message: 'webhook event identity is inconsistent',
        });
      }
      return existing;
    }
    try {
      return await this.prisma.paymentEvent.create({
        data: {
          provider: 'mercado_pago',
          externalId: payload.id,
          type: payload.type,
          action: payload.action,
          resourceId: payload.data.id,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
      const duplicate = await this.prisma.paymentEvent.findFirst({
        where: {
          provider: 'mercado_pago',
          type: payload.type,
          resourceId: payload.data.id,
        },
      });
      if (!duplicate) throw error;
      return duplicate;
    }
  }

  private markProcessed(id: string): Promise<unknown> {
    return this.prisma.paymentEvent.update({
      where: { id },
      data: { processedAt: new Date() },
    });
  }

  private markRetryable(id: string): Promise<unknown> {
    return this.prisma.paymentEvent.update({
      where: { id },
      data: { lastErrorAt: new Date() },
    });
  }
}

function addOneMonth(from: Date): Date {
  const result = new Date(from);
  result.setUTCMonth(result.getUTCMonth() + 1);
  return result;
}

function isTerminalPaymentFailure(payment: AuthorizedPayment): boolean {
  return (
    payment.invoiceStatus === 'processed' &&
    ['rejected', 'cancelled', 'canceled'].includes(payment.paymentStatus)
  );
}

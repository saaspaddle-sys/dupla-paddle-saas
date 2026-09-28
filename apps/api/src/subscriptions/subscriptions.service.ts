import {
  ServiceUnavailableException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PLAN_MAX_TOURNAMENTS } from '../clubs/clubs.service';
import { withSubscriptionLifecycleLock } from '../common/prisma/subscription-lifecycle-lock';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { PlanDowngradeQuoteResponseDto } from './dto/plan-downgrade.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import {
  AmbiguousPreapprovalCreationError,
  DefinitivePreapprovalRejectionError,
  MERCADO_PAGO_PREAPPROVAL_CLIENT,
} from './mercado-pago-preapproval.client';
import type {
  CreatedPreapproval,
  MercadoPagoPreapprovalClient,
  PreapprovalDetails,
} from './mercado-pago-preapproval.client';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(MERCADO_PAGO_PREAPPROVAL_CLIENT)
    private readonly mercadoPago: MercadoPagoPreapprovalClient,
  ) {}

  async findMine(userId: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: {
        id: true,
        plan: true,
        status: true,
        maxTournaments: true,
        currentPeriodEndsAt: true,
        providerStatus: true,
        providerPreapprovalId: true,
        pendingPlan: true,
        pendingPlanAmount: true,
        pendingPlanCurrency: true,
        pendingPlanConfirmedAt: true,
        pendingPlanEffectiveAt: true,
      },
    });
    if (!subscription)
      throw new InternalServerErrorException('club scope without subscription');
    const pendingUpgrade = await this.prisma.subscriptionUpgrade.findFirst({
      where: {
        subscriptionId: subscription.id,
        state: { in: ['creating', 'pending', 'paid', 'review_required'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      plan: subscription.plan,
      status: subscription.status,
      maxTournaments: subscription.maxTournaments,
      currentPeriodEndsAt: subscription.currentPeriodEndsAt,
      renewsAutomatically:
        subscription.providerPreapprovalId !== null &&
        subscription.providerStatus !== 'paused',
      pendingUpgrade:
        pendingUpgrade && pendingUpgrade.state !== 'applied'
          ? {
              state: pendingUpgrade.state,
              reference: pendingUpgrade.reference,
              amount: pendingUpgrade.amount.toFixed(2),
              currency: pendingUpgrade.currency,
              checkoutUrl: pendingUpgrade.checkoutUrl,
              periodEndsAt: pendingUpgrade.periodEndsAt,
            }
          : null,
      pendingDowngrade:
        subscription.pendingPlan === 'basic' &&
        subscription.pendingPlanAmount &&
        subscription.pendingPlanCurrency &&
        subscription.pendingPlanConfirmedAt &&
        subscription.pendingPlanEffectiveAt
          ? {
              targetPlan: 'basic',
              amount: subscription.pendingPlanAmount.toFixed(2),
              currency: subscription.pendingPlanCurrency,
              effectiveAt: subscription.pendingPlanEffectiveAt,
            }
          : null,
    };
  }

  async quoteDowngrade(userId: string): Promise<PlanDowngradeQuoteResponseDto> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!subscription)
      throw new InternalServerErrorException('club scope without subscription');
    this.assertDowngradeEligible(subscription);
    return this.downgradeQuoteFor(subscription);
  }

  async scheduleDowngrade(
    userId: string,
  ): Promise<PlanDowngradeQuoteResponseDto> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!subscription)
      throw new InternalServerErrorException('club scope without subscription');
    if (!this.mercadoPago.updateRecurringAmount)
      throw this.providerUnavailable();

    const reservation = await withSubscriptionLifecycleLock(
      this.prisma,
      subscription.id,
      async (tx) => {
        const current = await tx.subscription.findUniqueOrThrow({
          where: { id: subscription.id },
        });
        this.assertDowngradeEligible(current);
        const openUpgrade = await tx.subscriptionUpgrade.findFirst({
          where: {
            subscriptionId: current.id,
            state: { in: ['creating', 'pending', 'paid', 'review_required'] },
          },
          select: { id: true },
        });
        if (openUpgrade)
          throw new ConflictException({
            code: 'plan_change_in_progress',
            message: 'another plan change is in progress',
          });
        const quote = this.downgradeQuoteFor(current);
        if (!current.pendingPlan) {
          await tx.subscription.update({
            where: { id: current.id },
            data: {
              pendingPlan: 'basic',
              pendingPlanAmount: quote.amount,
              pendingPlanCurrency: quote.currency,
              pendingPlanConfirmedAt: null,
              pendingPlanEffectiveAt: quote.effectiveAt,
              pendingPlanPaidAt: null,
            },
          });
        }
        return {
          quote,
          preapprovalId: current.providerPreapprovalId!,
          confirmed: current.pendingPlanConfirmedAt !== null,
        };
      },
    );
    if (reservation.confirmed) return reservation.quote;
    try {
      await this.mercadoPago.updateRecurringAmount(reservation.preapprovalId, {
        amount: Number(reservation.quote.amount),
        currencyId: reservation.quote.currency,
      });
    } catch {
      throw this.providerUnavailable();
    }
    return withSubscriptionLifecycleLock(
      this.prisma,
      subscription.id,
      async (tx) => {
        const current = await tx.subscription.findUniqueOrThrow({
          where: { id: subscription.id },
        });
        this.assertDowngradeEligible(current);
        if (
          current.providerPreapprovalId !== reservation.preapprovalId ||
          current.pendingPlan !== 'basic' ||
          current.pendingPlanAmount?.toFixed(2) !== reservation.quote.amount ||
          current.pendingPlanCurrency !== reservation.quote.currency
        )
          throw new ConflictException({
            code: 'subscription_changed_during_downgrade',
            message: 'the subscription changed while scheduling the downgrade',
          });
        if (!current.pendingPlanConfirmedAt)
          await tx.subscription.update({
            where: { id: current.id },
            data: { pendingPlanConfirmedAt: new Date() },
          });
        return reservation.quote;
      },
    );
  }

  private assertDowngradeEligible(subscription: {
    plan: 'free' | 'basic' | 'pro';
    status: 'pending' | 'active' | 'past_due' | 'canceled';
    providerPreapprovalId: string | null;
    providerStatus: string | null;
    currentPeriodEndsAt: Date | null;
    pendingPlan: 'free' | 'basic' | 'pro' | null;
  }): void {
    if (
      subscription.plan !== 'pro' ||
      subscription.status !== 'active' ||
      !subscription.providerPreapprovalId ||
      subscription.providerStatus === 'paused' ||
      !subscription.currentPeriodEndsAt ||
      subscription.currentPeriodEndsAt <= new Date() ||
      (subscription.pendingPlan !== null &&
        subscription.pendingPlan !== 'basic')
    )
      throw new ConflictException({
        code: 'downgrade_unavailable',
        message: 'an active auto-renewing Pro subscription is required',
      });
  }

  private downgradeQuoteFor(subscription: {
    currentPeriodEndsAt: Date | null;
    pendingPlanEffectiveAt: Date | null;
    pendingPlan: 'free' | 'basic' | 'pro' | null;
    pendingPlanAmount: { toFixed(digits: number): string } | null;
    pendingPlanCurrency: string | null;
  }): PlanDowngradeQuoteResponseDto {
    if (subscription.pendingPlan === 'basic')
      return {
        targetPlan: 'basic',
        amount: subscription.pendingPlanAmount!.toFixed(2),
        currency: subscription.pendingPlanCurrency!,
        effectiveAt: subscription.pendingPlanEffectiveAt!,
      };
    const pricing = this.pricingFor('basic');
    return {
      targetPlan: 'basic',
      amount: pricing.amount.toFixed(2),
      currency: pricing.currency,
      effectiveAt: subscription.currentPeriodEndsAt!,
    };
  }

  async createCheckout(
    userId: string,
    targetPlan: 'basic' | 'pro',
  ): Promise<CheckoutResponseDto> {
    let subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { user: { select: { email: true } } },
    });
    if (!subscription)
      throw new InternalServerErrorException('club scope without subscription');
    // A completed checkout is historical, but its mandate still belongs to the
    // subscription. A second checkout must not create a second recurring charge.
    // An active Basic-to-Pro change uses a one-time payment and the same mandate.
    if (subscription.providerPreapprovalId) {
      const retired = await this.retireExpiredPausedMandate(subscription);
      if (retired) {
        subscription = await this.prisma.subscription.findUnique({
          where: { userId },
          include: { user: { select: { email: true } } },
        });
        if (!subscription)
          throw new InternalServerErrorException(
            'club scope without subscription',
          );
      }
    }
    if (subscription.providerPreapprovalId) {
      if (
        subscription.plan === 'basic' &&
        targetPlan === 'pro' &&
        subscription.providerStatus !== 'paused'
      ) {
        throw new ConflictException({
          code: 'subscription_upgrade_required',
          message:
            'Basic is already active; use POST /subscriptions/me/upgrade for a prorated immediate upgrade',
        });
      }
      throw new ConflictException({
        code:
          subscription.providerStatus === 'paused'
            ? 'paused_subscription_must_be_resumed'
            : 'active_subscription_must_be_cancelled',
        message:
          subscription.providerStatus === 'paused'
            ? 'renewal is paused; resume it or wait until the paid period ends before starting a new checkout'
            : 'an active subscription already exists; cancel renewal and wait until the paid period ends before starting a new checkout',
      });
    }
    const pricing = this.pricingFor(targetPlan);
    // Keep billing unavailable until inbound lifecycle notifications are
    // configured, but Mercado Pago owns that URL in the webhook dashboard.
    this.webhookUrl();
    this.requireAccessToken();
    const pending = await this.prisma.subscriptionCheckout.findFirst({
      where: {
        subscriptionId: subscription.id,
        state: { in: ['pending', 'recovery_required'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (pending) {
      if (pending.targetPlan !== targetPlan)
        throw new ConflictException({
          code: 'checkout_pending_for_another_plan',
          message: 'a checkout is already pending for another plan',
        });
      if (!pending.initPoint) {
        if (pending.state === 'recovery_required') {
          const recovered = await this.recoverPreapproval(pending.reference);
          if (recovered) {
            return this.persistPreapproval(pending.id, recovered, true);
          }
          throw new ServiceUnavailableException({
            code: 'billing_checkout_recovery_required',
            message: 'checkout outcome is awaiting recovery',
          });
        }
        throw new ConflictException({
          code: 'checkout_in_progress',
          message: 'a checkout is already being created',
        });
      }
      const canonical = await this.getCanonicalPendingPreapproval(pending);
      if (canonical.kind === 'reusable') {
        return {
          plan: pending.targetPlan,
          reference: pending.reference,
          checkoutUrl: canonical.preapproval.initPoint,
          reused: true,
        };
      }
      if (canonical.kind !== 'cancelled') {
        throw this.checkoutRecoveryRequired();
      }
      const replacement = await this.replaceCancelledCheckout(
        subscription.id,
        pending,
        targetPlan,
        pricing,
      );
      if (!replacement) {
        // Another request or a late provider notification changed the durable
        // checkout after this request observed it as cancelled. Never create a
        // second mandate from an outdated observation.
        throw new ConflictException({
          code: 'checkout_in_progress',
          message: 'a checkout is already being created',
        });
      }
      return this.createAndPersistPreapproval(
        replacement,
        subscription.user.email,
        targetPlan,
        pricing,
      );
    }
    const reference = randomUUID();
    let checkout: { id: string };
    try {
      checkout = await this.prisma.subscriptionCheckout.create({
        data: {
          subscriptionId: subscription.id,
          reference,
          targetPlan,
          amount: pricing.amount,
          currency: pricing.currency,
          state: 'recovery_required',
        },
      });
    } catch {
      throw new ConflictException({
        code: 'checkout_in_progress',
        message: 'a checkout is already being created',
      });
    }
    return this.createAndPersistPreapproval(
      { id: checkout.id, reference },
      subscription.user.email,
      targetPlan,
      pricing,
    );
  }

  /**
   * A paused mandate cannot be resumed once its paid period has ended. Retire
   * it on the checkout path instead of waiting for the background reconciler;
   * otherwise the owner has no self-service way to subscribe again. Provider
   * cancellation and the tombstone retain the duplicate-charge protection.
   */
  private async retireExpiredPausedMandate(subscription: {
    id: string;
    providerPreapprovalId: string | null;
    providerStatus: string | null;
    currentPeriodEndsAt: Date | null;
  }): Promise<boolean> {
    const preapprovalId = subscription.providerPreapprovalId;
    const now = new Date();
    if (
      !preapprovalId ||
      subscription.providerStatus !== 'paused' ||
      !subscription.currentPeriodEndsAt ||
      subscription.currentPeriodEndsAt > now
    )
      return false;
    if (!this.mercadoPago.cancelPreapproval) throw this.providerUnavailable();

    // Provider I/O is deliberately outside the lifecycle transaction. If its
    // response is lost, prove the cancellation with a canonical read first.
    try {
      await this.mercadoPago.cancelPreapproval(preapprovalId);
    } catch {
      const canonical = await this.readCanonicalPreapproval(preapprovalId);
      if (canonical !== 'cancelled') throw this.providerUnavailable();
    }

    return withSubscriptionLifecycleLock(
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
        // A newer lifecycle action won the race after the provider call. It
        // owns the next state, so never clear its mandate based on this stale
        // checkout attempt.
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
  }

  private async createAndPersistPreapproval(
    checkout: { id: string; reference: string },
    payerEmail: string,
    targetPlan: 'basic' | 'pro',
    pricing: { amount: number; currency: string; backUrl: string },
  ): Promise<CheckoutResponseDto> {
    let provider: CreatedPreapproval;
    try {
      provider = await this.mercadoPago.create({
        reference: checkout.reference,
        payerEmail,
        reason: `dupla ${targetPlan} monthly subscription`,
        amount: pricing.amount,
        currencyId: pricing.currency,
        backUrl: pricing.backUrl,
      });
    } catch (error) {
      if (error instanceof DefinitivePreapprovalRejectionError) {
        try {
          await this.prisma.subscriptionCheckout.delete({
            where: { id: checkout.id },
          });
        } catch {
          throw new ServiceUnavailableException({
            code: 'billing_checkout_recovery_required',
            message: 'checkout outcome is awaiting recovery',
          });
        }
        throw new ServiceUnavailableException({
          code: 'billing_provider_rejected',
          message: 'billing provider rejected checkout creation',
        });
      }
      if (error instanceof AmbiguousPreapprovalCreationError) {
        const recovered = await this.recoverPreapproval(checkout.reference);
        if (recovered) {
          return this.persistPreapproval(checkout.id, recovered, true);
        }
      }
      throw new ServiceUnavailableException({
        code: 'billing_checkout_recovery_required',
        message: 'checkout outcome is awaiting recovery',
      });
    }
    return this.persistPreapproval(checkout.id, provider, false);
  }

  /**
   * A locally pending checkout is only reusable while its canonical mandate
   * is still pending and still belongs to the same immutable reference.
   */
  private async getCanonicalPendingPreapproval(pending: {
    id: string;
    providerPreapprovalId: string | null;
    reference: string;
  }): Promise<
    | {
        kind: 'reusable';
        preapproval: PreapprovalDetails & { initPoint: string };
      }
    | { kind: 'cancelled' }
    | { kind: 'unavailable' }
  > {
    if (!pending.providerPreapprovalId) {
      this.logger.warn({
        event: 'mercado_pago_checkout_revalidation_missing_preapproval',
        checkoutId: pending.id,
      });
      return { kind: 'unavailable' };
    }
    let preapproval: PreapprovalDetails;
    try {
      preapproval = await this.mercadoPago.getPreapproval(
        pending.providerPreapprovalId,
      );
    } catch (error) {
      this.logger.warn({
        event: 'mercado_pago_checkout_revalidation_failed',
        checkoutId: pending.id,
        preapprovalId: pending.providerPreapprovalId,
        error: error instanceof Error ? error.name : 'unknown',
      });
      return { kind: 'unavailable' };
    }
    // Treat a malformed provider response exactly like an unavailable read.
    // In particular, a mismatched reference must never be reused or replaced.
    if (
      !preapproval ||
      preapproval.id !== pending.providerPreapprovalId ||
      preapproval.externalReference !== pending.reference ||
      typeof preapproval.status !== 'string'
    ) {
      this.logger.warn({
        event: 'mercado_pago_checkout_revalidation_mismatch',
        checkoutId: pending.id,
        preapprovalId: pending.providerPreapprovalId,
        providerPreapprovalId: preapproval?.id,
        referenceMatches: preapproval?.externalReference === pending.reference,
      });
      return { kind: 'unavailable' };
    }
    if (preapproval.status === 'cancelled') return { kind: 'cancelled' };
    if (
      preapproval.status === 'pending' &&
      typeof preapproval.initPoint === 'string'
    )
      return {
        kind: 'reusable',
        preapproval: { ...preapproval, initPoint: preapproval.initPoint },
      };
    this.logger.warn({
      event: 'mercado_pago_checkout_revalidation_unsupported_status',
      checkoutId: pending.id,
      preapprovalId: pending.providerPreapprovalId,
      status: preapproval.status,
      hasInitPoint: typeof preapproval.initPoint === 'string',
    });
    return { kind: 'unavailable' };
  }

  /**
   * This is intentionally one database transaction. The conditional update is
   * the final guard against a concurrent retry or a late webhook settling the
   * old checkout between canonical read and replacement reservation.
   */
  private async replaceCancelledCheckout(
    subscriptionId: string,
    pending: {
      id: string;
      reference: string;
      providerPreapprovalId: string | null;
    },
    targetPlan: 'basic' | 'pro',
    pricing: { amount: number; currency: string },
  ): Promise<{ id: string; reference: string } | null> {
    const replacementReference = randomUUID();
    try {
      return await withSubscriptionLifecycleLock(
        this.prisma,
        subscriptionId,
        async (tx) => {
          const expired = await tx.subscriptionCheckout.updateMany({
            where: {
              id: pending.id,
              subscriptionId,
              reference: pending.reference,
              providerPreapprovalId: pending.providerPreapprovalId,
              state: 'pending',
            },
            data: { state: 'expired', providerStatus: 'cancelled' },
          });
          if (expired.count !== 1) return null;
          const replacement = await tx.subscriptionCheckout.create({
            data: {
              subscriptionId,
              reference: replacementReference,
              targetPlan,
              amount: pricing.amount,
              currency: pricing.currency,
              state: 'recovery_required',
            },
            select: { id: true, reference: true },
          });
          return replacement;
        },
      );
    } catch {
      // A failed expiration must remain retryable; never create outside the
      // transaction after losing proof that the old mandate was retired.
      throw this.checkoutRecoveryRequired();
    }
  }

  private async recoverPreapproval(
    reference: string,
  ): Promise<CreatedPreapproval | null> {
    if (!this.mercadoPago.findPreapprovalByReference) return null;
    try {
      return await this.mercadoPago.findPreapprovalByReference(reference);
    } catch {
      return null;
    }
  }

  private async persistPreapproval(
    checkoutId: string,
    provider: CreatedPreapproval,
    reused: boolean,
  ): Promise<CheckoutResponseDto> {
    try {
      const persisted = await this.prisma.subscriptionCheckout.update({
        where: { id: checkoutId },
        data: {
          providerPreapprovalId: provider.id,
          providerStatus: provider.status,
          initPoint: provider.initPoint,
          state: 'pending',
        },
      });
      return {
        plan: persisted.targetPlan,
        reference: persisted.reference,
        checkoutUrl: persisted.initPoint!,
        reused,
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'billing_checkout_recovery_required',
        message: 'checkout was created and is awaiting recovery',
      });
    }
  }

  async cancelMine(userId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!subscription)
      throw new InternalServerErrorException('club scope without subscription');
    const snapshot = await this.prisma.subscription.findUniqueOrThrow({
      where: { id: subscription.id },
      select: { providerPreapprovalId: true, providerStatus: true },
    });
    if (!snapshot.providerPreapprovalId || snapshot.providerStatus === 'paused')
      return;
    if (!this.mercadoPago.pausePreapproval) throw this.providerUnavailable();
    // Do not hold the database advisory transaction over a provider request.
    // If the HTTP response is lost, the following canonical read distinguishes
    // an applied pause from an unavailable provider before touching local state.
    try {
      await this.mercadoPago.pausePreapproval(snapshot.providerPreapprovalId);
    } catch {
      const canonical = await this.readCanonicalPreapproval(
        snapshot.providerPreapprovalId,
      );
      if (canonical !== 'paused') throw this.providerUnavailable();
    }
    const pausedAt = new Date();
    await withSubscriptionLifecycleLock(
      this.prisma,
      subscription.id,
      async (tx) => {
        const current = await tx.subscription.findUniqueOrThrow({
          where: { id: subscription.id },
          select: { providerPreapprovalId: true, providerStatus: true },
        });
        if (current.providerPreapprovalId !== snapshot.providerPreapprovalId)
          return;
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            providerStatus: 'paused',
            pausedAt,
          },
        });
      },
    );
  }

  async resumeMine(userId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!subscription)
      throw new InternalServerErrorException('club scope without subscription');
    const snapshot = await this.prisma.subscription.findUniqueOrThrow({
      where: { id: subscription.id },
      select: {
        providerPreapprovalId: true,
        providerStatus: true,
        currentPeriodEndsAt: true,
      },
    });
    if (snapshot.providerStatus !== 'paused') return;
    if (
      !snapshot.providerPreapprovalId ||
      !snapshot.currentPeriodEndsAt ||
      snapshot.currentPeriodEndsAt <= new Date()
    ) {
      throw new ConflictException({
        code: 'paused_subscription_period_ended',
        message: 'the paused subscription period has ended',
      });
    }
    if (!this.mercadoPago.resumePreapproval) throw this.providerUnavailable();
    try {
      await this.mercadoPago.resumePreapproval(snapshot.providerPreapprovalId);
    } catch {
      const canonical = await this.readCanonicalPreapproval(
        snapshot.providerPreapprovalId,
      );
      if (canonical !== 'authorized') throw this.providerUnavailable();
    }
    await withSubscriptionLifecycleLock(
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
          current.providerStatus !== 'paused' ||
          current.providerPreapprovalId !== snapshot.providerPreapprovalId
        )
          return;
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { providerStatus: 'authorized', pausedAt: null },
        });
      },
    );
  }

  private async readCanonicalPreapproval(
    preapprovalId: string,
  ): Promise<string | null> {
    try {
      const preapproval = await this.mercadoPago.getPreapproval(preapprovalId);
      return preapproval.id === preapprovalId ? preapproval.status : null;
    } catch {
      return null;
    }
  }
  private providerUnavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'billing_provider_unavailable',
      message: 'billing provider is unavailable',
    });
  }

  private checkoutRecoveryRequired(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'billing_checkout_recovery_required',
      message: 'checkout outcome is awaiting recovery',
    });
  }
  private webhookUrl(): string {
    const webhookUrl = this.config.get<string>('MERCADO_PAGO_WEBHOOK_URL');
    try {
      if (!webhookUrl || new URL(webhookUrl).protocol !== 'https:')
        throw new Error();
    } catch {
      throw new ServiceUnavailableException({
        code: 'billing_not_configured',
        message: 'billing is not configured',
      });
    }
    return webhookUrl;
  }

  private pricingFor(plan: 'basic' | 'pro'): {
    amount: number;
    currency: string;
    backUrl: string;
  } {
    const raw = this.config.get<string>(
      plan === 'basic'
        ? 'MERCADO_PAGO_BASIC_AMOUNT'
        : 'MERCADO_PAGO_PRO_AMOUNT',
    );
    const amount = Number(raw);
    const currency = this.config.get<string>('MERCADO_PAGO_CURRENCY');
    const backUrl = this.config.get<string>('MERCADO_PAGO_BACK_URL');

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isInteger(amount * 100) ||
      !currency ||
      !backUrl ||
      !isHttpsUrl(backUrl)
    )
      throw new ServiceUnavailableException({
        code: 'billing_not_configured',
        message: 'billing is not configured',
      });
    return { amount, currency, backUrl };
  }

  private requireAccessToken(): void {
    if (!this.config.get<string>('MERCADO_PAGO_ACCESS_TOKEN')) {
      throw new ServiceUnavailableException({
        code: 'billing_not_configured',
        message: 'billing is not configured',
      });
    }
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

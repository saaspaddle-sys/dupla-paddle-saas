import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PLAN_MAX_TOURNAMENTS } from '../clubs/clubs.service';
import { withSubscriptionLifecycleLock } from '../common/prisma/subscription-lifecycle-lock';
import { Prisma, type Subscription } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ImmediateUpgradeCheckoutDto,
  ImmediateUpgradeQuoteDto,
} from './dto/immediate-upgrade.dto';
import { MERCADO_PAGO_PREAPPROVAL_CLIENT } from './mercado-pago-preapproval.client';
import type {
  AuthorizedPayment,
  MercadoPagoPreapprovalClient,
  UpgradePayment,
  UpgradePreference,
} from './mercado-pago-preapproval.client';

const OPEN_STATES = ['creating', 'pending', 'paid', 'review_required'] as const;
const BILLING_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const billingDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BILLING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function billingDateKey(date: Date): string {
  const parts = billingDateFormatter.formatToParts(date);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function startOfBillingDay(now: Date): Date {
  const day = billingDateKey(now);
  let before = now.getTime() - 48 * 60 * 60 * 1000;
  let start = now.getTime();
  while (start - before > 1) {
    const middle = Math.floor((before + start) / 2);
    if (billingDateKey(new Date(middle)) === day) start = middle;
    else before = middle;
  }
  return new Date(start);
}

@Injectable()
export class SubscriptionUpgradeService {
  private readonly logger = new Logger(SubscriptionUpgradeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(MERCADO_PAGO_PREAPPROVAL_CLIENT)
    private readonly mercadoPago: MercadoPagoPreapprovalClient,
  ) {}

  async quote(userId: string): Promise<ImmediateUpgradeQuoteDto> {
    let subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!subscription)
      throw new InternalServerErrorException('club scope without subscription');
    subscription = await this.ensureCurrentPeriodCharge(subscription);
    const existing = await this.prisma.subscriptionUpgrade.findFirst({
      where: {
        subscriptionId: subscription.id,
        state: { in: [...OPEN_STATES] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      if (!this.stillEligible(subscription, existing))
        throw new ConflictException({
          code: 'upgrade_period_changed',
          message: 'the paid period changed while an upgrade was in progress',
        });
      return {
        targetPlan: 'pro',
        amount: existing.amount.toFixed(2),
        recurringAmount: existing.recurringAmount.toFixed(2),
        currency: existing.currency,
        periodEndsAt: existing.periodEndsAt,
      };
    }
    return this.quoteFor(subscription, new Date());
  }

  async createCheckout(
    userId: string,
    expectedAmount: string,
  ): Promise<ImmediateUpgradeCheckoutDto> {
    if (
      !this.mercadoPago.createUpgradePreference ||
      !this.mercadoPago.findUpgradePreferenceByReference
    )
      throw this.providerUnavailable();
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { id: true, user: { select: { email: true } } },
    });
    if (!subscription)
      throw new InternalServerErrorException('club scope without subscription');
    const currentSubscription =
      await this.prisma.subscription.findUniqueOrThrow({
        where: { id: subscription.id },
      });
    await this.ensureCurrentPeriodCharge(currentSubscription);
    const backUrl = this.requiredHttpsUrl('MERCADO_PAGO_BACK_URL');
    const notificationUrl = this.requiredHttpsUrl('MERCADO_PAGO_WEBHOOK_URL');
    const reservation = await withSubscriptionLifecycleLock(
      this.prisma,
      subscription.id,
      async (tx) => {
        const current = await tx.subscription.findUniqueOrThrow({
          where: { id: subscription.id },
        });
        const existing = await tx.subscriptionUpgrade.findFirst({
          where: {
            subscriptionId: current.id,
            state: { in: [...OPEN_STATES] },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (existing) {
          if (!this.stillEligible(current, existing))
            throw new ConflictException({
              code: 'upgrade_period_changed',
              message:
                'the paid period changed while an upgrade was in progress',
            });
          this.assertExpectedAmount(existing.amount.toFixed(2), expectedAmount);
          return { upgrade: existing, reused: true };
        }
        const quote = this.quoteFor(current, new Date());
        this.assertExpectedAmount(quote.amount, expectedAmount);
        const created = await tx.subscriptionUpgrade.create({
          data: {
            subscriptionId: current.id,
            reference: randomUUID(),
            preapprovalId: current.providerPreapprovalId!,
            amount: quote.amount,
            recurringAmount: quote.recurringAmount,
            currency: quote.currency,
            periodStartedAt: current.currentPeriodStartedAt!,
            periodEndsAt: quote.periodEndsAt,
          },
        });
        return { upgrade: created, reused: false };
      },
    );
    const upgrade = reservation.upgrade;
    if (upgrade.state === 'paid' || upgrade.state === 'review_required')
      throw this.recoveryRequired();
    if (upgrade.state === 'pending' && upgrade.checkoutUrl)
      return this.toCheckout(upgrade, true);
    let preference: UpgradePreference | null;
    try {
      preference = reservation.reused
        ? await this.mercadoPago.findUpgradePreferenceByReference(
            upgrade.reference,
          )
        : await this.mercadoPago.createUpgradePreference({
            reference: upgrade.reference,
            payerEmail: subscription.user.email,
            amount: Number(upgrade.amount),
            currencyId: upgrade.currency,
            backUrl,
            notificationUrl,
            expiresAt: upgrade.periodEndsAt,
            startsAt: new Date(),
          });
    } catch {
      try {
        preference = await this.mercadoPago.findUpgradePreferenceByReference(
          upgrade.reference,
        );
      } catch {
        throw this.recoveryRequired();
      }
    }
    if (!preference || preference.reference !== upgrade.reference)
      throw this.recoveryRequired();
    try {
      const persisted = await this.prisma.subscriptionUpgrade.update({
        where: { id: upgrade.id },
        data: {
          preferenceId: preference.id,
          checkoutUrl: preference.checkoutUrl,
          state: 'pending',
        },
      });
      return this.toCheckout(persisted, reservation.reused);
    } catch {
      throw this.recoveryRequired();
    }
  }

  async processPaymentEvent(
    eventId: string,
    resourceId: string,
  ): Promise<void> {
    if (!this.mercadoPago.getUpgradePayment) throw this.providerUnavailable();
    let payment: UpgradePayment;
    try {
      payment = await this.mercadoPago.getUpgradePayment(resourceId);
    } catch {
      throw this.providerUnavailable();
    }
    if (payment.id !== resourceId) throw this.providerUnavailable();
    await this.applyPayment(payment, eventId);
  }

  async reconcile(limit = 100): Promise<number> {
    const candidates = await this.prisma.subscriptionUpgrade.findMany({
      where: { state: { in: ['creating', 'pending', 'paid'] } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    let progressed = 0;
    for (const upgrade of candidates) {
      try {
        if (upgrade.state === 'creating') {
          if (!this.mercadoPago.findUpgradePreferenceByReference) continue;
          const preference =
            await this.mercadoPago.findUpgradePreferenceByReference(
              upgrade.reference,
            );
          if (!preference) continue;
          await this.prisma.subscriptionUpgrade.update({
            where: { id: upgrade.id },
            data: {
              preferenceId: preference.id,
              checkoutUrl: preference.checkoutUrl,
              state: 'pending',
            },
          });
          progressed += 1;
        } else if (upgrade.state === 'pending') {
          if (!this.mercadoPago.findUpgradePaymentsByReference) continue;
          const payments =
            await this.mercadoPago.findUpgradePaymentsByReference(
              upgrade.reference,
            );
          for (const payment of payments) {
            if (payment.status === 'approved') {
              await this.applyPayment(payment, null);
              progressed += 1;
              break;
            }
          }
        } else {
          await this.completePaidUpgrade(upgrade.id);
          progressed += 1;
        }
      } catch {
        // A single unavailable provider resource must not starve other work.
      }
    }
    return progressed;
  }

  private async applyPayment(
    payment: UpgradePayment,
    eventId: string | null,
  ): Promise<void> {
    const upgrade = await this.prisma.subscriptionUpgrade.findUnique({
      where: { reference: payment.reference },
    });
    if (!upgrade) {
      if (eventId)
        await this.prisma.paymentEvent.update({
          where: { id: eventId },
          data: { processedAt: new Date() },
        });
      return;
    }
    const reviewReason = await withSubscriptionLifecycleLock(
      this.prisma,
      upgrade.subscriptionId,
      async (tx) => {
        const current = await tx.subscriptionUpgrade.findUniqueOrThrow({
          where: { id: upgrade.id },
        });
        if (eventId) {
          const event = await tx.paymentEvent.findUniqueOrThrow({
            where: { id: eventId },
          });
          if (event.processedAt) return null;
        }
        let reviewReason: string | null = null;
        const correlated =
          payment.reference === current.reference &&
          current.amount.equals(new Prisma.Decimal(payment.amount)) &&
          current.currency === payment.currencyId;
        if (!correlated) {
          await tx.subscriptionUpgrade.update({
            where: { id: current.id },
            data: { state: 'review_required' },
          });
          reviewReason = 'payment_amount_or_currency_mismatch';
        } else if (payment.status === 'approved' && payment.approvedAt) {
          if (current.paymentId && current.paymentId !== payment.id) {
            await tx.subscriptionUpgrade.update({
              where: { id: current.id },
              data: { state: 'review_required' },
            });
            reviewReason = 'multiple_approved_payments';
          } else if (
            current.state === 'pending' ||
            current.state === 'creating'
          ) {
            await tx.subscriptionUpgrade.update({
              where: { id: current.id },
              data: { state: 'paid', paymentId: payment.id },
            });
          }
        }
        if (eventId)
          await tx.paymentEvent.update({
            where: { id: eventId },
            data: {
              processedAt: new Date(),
              subscriptionId: current.subscriptionId,
            },
          });
        return reviewReason;
      },
    );
    if (reviewReason)
      this.logger.error({
        event: 'subscription_upgrade_review_required',
        upgradeId: upgrade.id,
        paymentId: payment.id,
        reason: reviewReason,
      });
    if (payment.status === 'approved')
      await this.completePaidUpgrade(upgrade.id);
  }

  private async completePaidUpgrade(upgradeId: string): Promise<void> {
    const upgrade = await this.prisma.subscriptionUpgrade.findUniqueOrThrow({
      where: { id: upgradeId },
    });
    if (upgrade.state !== 'paid') return;
    const subscription = await this.prisma.subscription.findUniqueOrThrow({
      where: { id: upgrade.subscriptionId },
    });
    if (!this.stillEligible(subscription, upgrade)) {
      await this.prisma.subscriptionUpgrade.update({
        where: { id: upgradeId },
        data: { state: 'review_required' },
      });
      this.logger.error({
        event: 'subscription_upgrade_review_required',
        upgradeId,
        paymentId: upgrade.paymentId,
        reason: 'subscription_or_paid_period_changed',
      });
      return;
    }
    if (!this.mercadoPago.updateRecurringAmount)
      throw this.providerUnavailable();
    try {
      await this.mercadoPago.updateRecurringAmount(upgrade.preapprovalId, {
        amount: Number(upgrade.recurringAmount),
        currencyId: upgrade.currency,
      });
    } catch {
      throw this.providerUnavailable();
    }
    await withSubscriptionLifecycleLock(
      this.prisma,
      upgrade.subscriptionId,
      async (tx) => {
        const current = await tx.subscription.findUniqueOrThrow({
          where: { id: upgrade.subscriptionId },
        });
        const intent = await tx.subscriptionUpgrade.findUniqueOrThrow({
          where: { id: upgradeId },
        });
        if (intent.state !== 'paid') return;
        if (!this.stillEligible(current, intent)) {
          await tx.subscriptionUpgrade.update({
            where: { id: upgradeId },
            data: { state: 'review_required' },
          });
          this.logger.error({
            event: 'subscription_upgrade_review_required',
            upgradeId,
            paymentId: intent.paymentId,
            reason: 'subscription_changed_after_mandate_update',
          });
          return;
        }
        await tx.subscription.update({
          where: { id: current.id },
          data: { plan: 'pro', maxTournaments: PLAN_MAX_TOURNAMENTS.pro },
        });
        await tx.subscriptionUpgrade.update({
          where: { id: upgradeId },
          data: { state: 'applied' },
        });
      },
    );
  }

  private stillEligible(
    subscription: Subscription,
    upgrade: {
      preapprovalId: string;
      periodEndsAt: Date;
      periodStartedAt: Date;
    },
  ): boolean {
    return (
      subscription.plan === 'basic' &&
      subscription.status === 'active' &&
      subscription.providerPreapprovalId === upgrade.preapprovalId &&
      subscription.providerStatus !== 'paused' &&
      subscription.pendingPlan === null &&
      subscription.currentPeriodEndsAt?.getTime() ===
        upgrade.periodEndsAt.getTime() &&
      subscription.currentPeriodStartedAt?.getTime() ===
        upgrade.periodStartedAt.getTime() &&
      upgrade.periodEndsAt > new Date()
    );
  }

  private async ensureCurrentPeriodCharge(
    subscription: Subscription,
  ): Promise<Subscription> {
    if (
      subscription.currentPeriodStartedAt &&
      subscription.currentPeriodAmount &&
      subscription.currentPeriodCurrency
    )
      return subscription;
    if (
      !subscription.providerPreapprovalId ||
      !subscription.currentPeriodEndsAt ||
      !this.mercadoPago.findAuthorizedPaymentsByPreapproval
    )
      throw new ConflictException({
        code: 'upgrade_charge_history_unavailable',
        message: 'the current paid charge could not be verified',
      });
    let payments: AuthorizedPayment[];
    try {
      payments = await this.mercadoPago.findAuthorizedPaymentsByPreapproval(
        subscription.providerPreapprovalId,
      );
    } catch {
      throw this.providerUnavailable();
    }
    const current = payments.find((payment) => {
      const end = new Date(payment.paidAt);
      end.setUTCMonth(end.getUTCMonth() + 1);
      return (
        payment.preapprovalId === subscription.providerPreapprovalId &&
        payment.paymentStatus === 'approved' &&
        end.getTime() === subscription.currentPeriodEndsAt!.getTime()
      );
    });
    if (!current)
      throw new ConflictException({
        code: 'upgrade_charge_history_unavailable',
        message: 'the current paid charge could not be verified',
      });
    return withSubscriptionLifecycleLock(
      this.prisma,
      subscription.id,
      async (tx) => {
        const latest = await tx.subscription.findUniqueOrThrow({
          where: { id: subscription.id },
        });
        if (
          latest.providerPreapprovalId !== subscription.providerPreapprovalId ||
          latest.currentPeriodEndsAt?.getTime() !==
            subscription.currentPeriodEndsAt?.getTime()
        )
          throw new ConflictException({
            code: 'upgrade_period_changed',
            message: 'the paid period changed while verifying its charge',
          });
        if (
          latest.currentPeriodStartedAt &&
          latest.currentPeriodAmount &&
          latest.currentPeriodCurrency
        )
          return latest;
        return tx.subscription.update({
          where: { id: latest.id },
          data: {
            currentPeriodStartedAt: current.paidAt,
            currentPeriodAmount: new Prisma.Decimal(current.amount),
            currentPeriodCurrency: current.currencyId,
          },
        });
      },
    );
  }

  private quoteFor(
    subscription: Subscription,
    now: Date,
  ): ImmediateUpgradeQuoteDto {
    const ends = subscription.currentPeriodEndsAt;
    const starts = subscription.currentPeriodStartedAt;
    const paid = subscription.currentPeriodAmount;
    const currency = this.config.get<string>('MERCADO_PAGO_CURRENCY');
    const proAmount = Number(
      this.config.get<string>('MERCADO_PAGO_PRO_AMOUNT'),
    );
    if (
      !currency ||
      !Number.isFinite(proAmount) ||
      proAmount <= 0 ||
      !Number.isInteger(proAmount * 100)
    )
      throw new ServiceUnavailableException({
        code: 'billing_not_configured',
        message: 'billing is not configured',
      });
    if (
      subscription.plan !== 'basic' ||
      subscription.status !== 'active' ||
      !subscription.providerPreapprovalId ||
      subscription.providerStatus === 'paused' ||
      subscription.pendingPlan !== null ||
      !starts ||
      !ends ||
      !paid ||
      subscription.currentPeriodCurrency !== currency ||
      starts >= now ||
      ends <= now ||
      starts >= ends
    )
      throw new ConflictException({
        code: 'upgrade_unavailable',
        message: 'an active paid Basic period is required',
      });
    const paidCents = Math.round(Number(paid) * 100);
    const proCents = Math.round(proAmount * 100);
    const billingDayStart = startOfBillingDay(now);
    const chargeFrom = Math.max(starts.getTime(), billingDayStart.getTime());
    const remaining = ends.getTime() - chargeFrom;
    const duration = ends.getTime() - starts.getTime();
    const chargeCents = Math.round(
      ((proCents - paidCents) * remaining) / duration,
    );
    if (proCents <= paidCents || chargeCents < 1)
      throw new ConflictException({
        code: 'upgrade_proration_unavailable',
        message: 'no positive prorated upgrade charge remains',
      });
    return {
      targetPlan: 'pro',
      amount: (chargeCents / 100).toFixed(2),
      recurringAmount: proAmount.toFixed(2),
      currency,
      periodEndsAt: ends,
    };
  }

  private assertExpectedAmount(amount: string, expectedAmount: string): void {
    if (amount !== expectedAmount)
      throw new ConflictException({
        code: 'upgrade_quote_changed',
        message: 'the upgrade price changed; request a new quote',
      });
  }

  private toCheckout(
    upgrade: {
      reference: string;
      checkoutUrl: string | null;
      amount: Prisma.Decimal;
      recurringAmount: Prisma.Decimal;
      currency: string;
      periodEndsAt: Date;
    },
    reused: boolean,
  ): ImmediateUpgradeCheckoutDto {
    return {
      targetPlan: 'pro',
      reference: upgrade.reference,
      checkoutUrl: upgrade.checkoutUrl!,
      amount: upgrade.amount.toFixed(2),
      recurringAmount: upgrade.recurringAmount.toFixed(2),
      currency: upgrade.currency,
      periodEndsAt: upgrade.periodEndsAt,
      reused,
    };
  }

  private requiredHttpsUrl(key: string): string {
    const value = this.config.get<string>(key);
    try {
      if (!value || new URL(value).protocol !== 'https:') throw new Error();
    } catch {
      throw new ServiceUnavailableException({
        code: 'billing_not_configured',
        message: 'billing is not configured',
      });
    }
    return value;
  }

  private providerUnavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'billing_provider_unavailable',
      message: 'billing provider is unavailable',
    });
  }

  private recoveryRequired(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'billing_upgrade_recovery_required',
      message: 'upgrade outcome is awaiting recovery',
    });
  }
}

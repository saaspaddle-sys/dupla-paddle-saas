import {
  ServiceUnavailableException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import {
  AmbiguousPreapprovalCreationError,
  DefinitivePreapprovalRejectionError,
  MERCADO_PAGO_PREAPPROVAL_CLIENT,
} from './mercado-pago-preapproval.client';
import type {
  CreatedPreapproval,
  MercadoPagoPreapprovalClient,
} from './mercado-pago-preapproval.client';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(MERCADO_PAGO_PREAPPROVAL_CLIENT)
    private readonly mercadoPago: MercadoPagoPreapprovalClient,
  ) {}

  async findMine(userId: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true, maxTournaments: true },
    });
    if (!subscription)
      throw new InternalServerErrorException('club scope without subscription');
    return subscription;
  }

  async createCheckout(
    userId: string,
    targetPlan: 'basic' | 'pro',
  ): Promise<CheckoutResponseDto> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { user: { select: { email: true } } },
    });
    if (!subscription)
      throw new InternalServerErrorException('club scope without subscription');
    // A completed checkout is historical. The mandate belongs to the
    // subscription and must be cancelled explicitly before a replacement can
    // be created, otherwise one owner can authorize two recurring charges.
    if (subscription.providerPreapprovalId) {
      throw new ConflictException({
        code: 'active_subscription_must_be_cancelled',
        message:
          'cancel the active subscription before creating another checkout',
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
      return {
        plan: pending.targetPlan,
        reference: pending.reference,
        checkoutUrl: pending.initPoint,
        reused: true,
      };
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
    let provider: CreatedPreapproval;
    try {
      provider = await this.mercadoPago.create({
        reference,
        payerEmail: subscription.user.email,
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
        const recovered = await this.recoverPreapproval(reference);
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
      select: { id: true, providerPreapprovalId: true },
    });
    if (!subscription)
      throw new InternalServerErrorException('club scope without subscription');
    if (!subscription.providerPreapprovalId) return;
    if (!this.mercadoPago.cancelPreapproval)
      throw new ServiceUnavailableException({
        code: 'billing_provider_unavailable',
        message: 'billing provider is unavailable',
      });
    try {
      await this.mercadoPago.cancelPreapproval(
        subscription.providerPreapprovalId,
      );
    } catch {
      throw new ServiceUnavailableException({
        code: 'billing_provider_unavailable',
        message: 'billing provider is unavailable',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      // Keep this identity after replacing the mandate. Provider deliveries are
      // at-least-once and a late charge must be auditable, but never grant a
      // newly re-subscribed account an old entitlement.
      await tx.subscriptionPreapprovalTombstone.create({
        data: {
          provider: 'mercado_pago',
          providerPreapprovalId: subscription.providerPreapprovalId!,
          subscriptionId: subscription.id,
        },
      });
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          plan: 'free',
          status: 'canceled',
          maxTournaments: 1,
          providerPreapprovalId: null,
          providerStatus: 'cancelled',
          currentPeriodEndsAt: null,
        },
      });
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

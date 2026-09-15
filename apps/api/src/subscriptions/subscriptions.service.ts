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
        if (pending.state === 'recovery_required')
          throw new ServiceUnavailableException({
            code: 'billing_checkout_recovery_required',
            message: 'checkout outcome is awaiting recovery',
          });
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
    const pricing = this.pricingFor(targetPlan);
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
        notificationUrl: this.webhookUrl(),
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
      throw new ServiceUnavailableException({
        code: 'billing_checkout_recovery_required',
        message: 'checkout outcome is awaiting recovery',
      });
    }
    try {
      const persisted = await this.prisma.subscriptionCheckout.update({
        where: { id: checkout.id },
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
        reused: false,
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'billing_checkout_recovery_required',
        message: 'checkout was created and is awaiting recovery',
      });
    }
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
    if (!Number.isFinite(amount) || amount <= 0 || !currency || !backUrl)
      throw new ServiceUnavailableException({
        code: 'billing_not_configured',
        message: 'billing is not configured',
      });
    return { amount, currency, backUrl };
  }
}

import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PLAN_MAX_TOURNAMENTS } from '../clubs/clubs.service';
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

const CHARGE_NOTIFICATION_TYPE = 'subscription_authorized_payment';

@Injectable()
export class MercadoPagoWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MERCADO_PAGO_PREAPPROVAL_CLIENT)
    private readonly mercadoPago: MercadoPagoPreapprovalClient,
    @Inject(MERCADO_PAGO_WEBHOOK_VERIFIER)
    private readonly verifier: MercadoPagoWebhookVerifier,
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

  /** No grace period beyond the paid period; invoke from the scheduled worker. */
  async expirePastDueEntitlements(now = new Date()): Promise<number> {
    const result = await this.prisma.subscription.updateMany({
      // Provider failure webhooks are not a reliable clock. An active mandate
      // whose paid period elapsed must lose paid entitlement even when its
      // renewal notification was lost or delayed.
      where: {
        status: { in: ['active', 'past_due'] },
        currentPeriodEndsAt: { lte: now },
      },
      data: {
        plan: 'free',
        status: 'canceled',
        maxTournaments: PLAN_MAX_TOURNAMENTS.free,
        currentPeriodEndsAt: null,
      },
    });
    return result.count;
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

    const outcome = await runSerializable(this.prisma, async (tx) => {
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
        if (subscription && isTerminalPaymentFailure(payment)) {
          await tx.subscription.update({
            where: { id: subscription.id },
            data: { status: 'past_due', providerStatus: payment.invoiceStatus },
          });
        }
        await tx.paymentEvent.update({
          where: { id: event.id },
          data: isTerminalPaymentFailure(payment)
            ? { processedAt: new Date(), subscriptionId: subscription?.id }
            : { lastErrorAt: new Date() },
        });
        return isTerminalPaymentFailure(payment)
          ? ('processed' as const)
          : ('retryable' as const);
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

      const subscriptionId = expectedCheckout
        ? checkout.subscriptionId
        : subscription!.id;
      const targetPlan = expectedCheckout
        ? checkout.targetPlan
        : subscription!.plan;
      const paidThrough = addOneMonth(payment.paidAt);
      // Webhooks can arrive out of order. The newest paid-through boundary is
      // monotonic; an old invoice must never shorten an already paid period.
      const currentPeriodEndsAt = subscription?.currentPeriodEndsAt;
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
          providerStatus: payment.invoiceStatus,
          currentPeriodEndsAt: effectivePeriodEndsAt,
        },
      });
      if (expectedCheckout) {
        await tx.subscriptionCheckout.update({
          where: { id: checkout.id },
          data: { state: 'completed', providerStatus: payment.invoiceStatus },
        });
      }
      await tx.paymentEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date(), subscriptionId },
      });
      return 'processed' as const;
    });
    if (outcome === 'retryable') throw this.providerUnavailable();
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

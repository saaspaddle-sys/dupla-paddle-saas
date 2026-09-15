import {
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
  ): Promise<void> {
    if (!signature || !requestId)
      throw new UnauthorizedException({
        code: 'invalid_webhook_signature',
        message: 'webhook signature is invalid',
      });
    if (
      !this.verifier.verify({ signature, requestId, dataId: payload.data.id })
    )
      throw new UnauthorizedException({
        code: 'invalid_webhook_signature',
        message: 'webhook signature is invalid',
      });

    await this.persistEvent(payload);
    if (payload.type !== CHARGE_NOTIFICATION_TYPE) {
      await this.markProcessed(payload.id);
      return;
    }
    let payment: AuthorizedPayment;
    try {
      payment = await this.mercadoPago.getAuthorizedPayment(payload.data.id);
    } catch (error) {
      if (error instanceof ProviderUnavailableError)
        throw new ServiceUnavailableException({
          code: 'billing_provider_unavailable',
          message: 'billing provider is unavailable',
        });
      throw error;
    }
    // El proveedor respondiÃ³ 2xx pero para otro recurso: es un hecho
    // definitivo e inconsistente, no una falla transitoria que un retry vaya
    // a arreglar. Conservamos el evento como no-op terminal.
    if (payment.id !== payload.data.id) {
      await this.markProcessed(payload.id);
      return;
    }
    await runSerializable(this.prisma, async (tx) => {
      const event = await tx.paymentEvent.findUniqueOrThrow({
        where: {
          provider_externalId: {
            provider: 'mercado_pago',
            externalId: payload.id,
          },
        },
      });
      if (event.processedAt) return;
      const checkout = await tx.subscriptionCheckout.findFirst({
        where: {
          provider: 'mercado_pago',
          providerPreapprovalId: payment.preapprovalId,
        },
      });
      const isExpectedPayment =
        checkout &&
        checkout.state === 'pending' &&
        checkout.amount.equals(new Prisma.Decimal(payment.amount)) &&
        checkout.currency === payment.currencyId &&
        checkout.reference === payment.externalReference &&
        payment.status === 'approved';
      if (isExpectedPayment) {
        await tx.subscription.update({
          where: { id: checkout.subscriptionId },
          data: {
            plan: checkout.targetPlan,
            status: 'active',
            maxTournaments: PLAN_MAX_TOURNAMENTS[checkout.targetPlan],
          },
        });
        await tx.subscriptionCheckout.update({
          where: { id: checkout.id },
          data: { state: 'completed', providerStatus: payment.status },
        });
        await tx.paymentEvent.update({
          where: { id: event.id },
          data: {
            processedAt: new Date(),
            subscriptionId: checkout.subscriptionId,
          },
        });
        return;
      }
      await tx.paymentEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
    });
  }

  private async persistEvent(payload: MercadoPagoWebhookDto): Promise<void> {
    try {
      await this.prisma.paymentEvent.create({
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
    }
  }

  private async markProcessed(externalId: string): Promise<void> {
    await this.prisma.paymentEvent.update({
      where: { provider_externalId: { provider: 'mercado_pago', externalId } },
      data: { processedAt: new Date() },
    });
  }
}

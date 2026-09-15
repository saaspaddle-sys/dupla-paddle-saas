import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MercadoPagoHttpPreapprovalClient } from './mercado-pago-http-preapproval.client';
import { MercadoPagoWebhookController } from './mercado-pago-webhook.controller';
import { MercadoPagoWebhookService } from './mercado-pago-webhook.service';
import {
  MercadoPagoHmacWebhookVerifier,
  MERCADO_PAGO_WEBHOOK_VERIFIER,
} from './mercado-pago-webhook-verifier';
import { MERCADO_PAGO_PREAPPROVAL_CLIENT } from './mercado-pago-preapproval.client';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SubscriptionsController, MercadoPagoWebhookController],
  providers: [
    SubscriptionsService,
    MercadoPagoHttpPreapprovalClient,
    MercadoPagoHmacWebhookVerifier,
    MercadoPagoWebhookService,
    {
      provide: MERCADO_PAGO_PREAPPROVAL_CLIENT,
      useExisting: MercadoPagoHttpPreapprovalClient,
    },
    {
      provide: MERCADO_PAGO_WEBHOOK_VERIFIER,
      useExisting: MercadoPagoHmacWebhookVerifier,
    },
  ],
})
export class SubscriptionsModule {}

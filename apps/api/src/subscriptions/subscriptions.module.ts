import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MercadoPagoHttpPreapprovalClient } from './mercado-pago-http-preapproval.client';
import { MERCADO_PAGO_PREAPPROVAL_CLIENT } from './mercado-pago-preapproval.client';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    MercadoPagoHttpPreapprovalClient,
    {
      provide: MERCADO_PAGO_PREAPPROVAL_CLIENT,
      useExisting: MercadoPagoHttpPreapprovalClient,
    },
  ],
})
export class SubscriptionsModule {}

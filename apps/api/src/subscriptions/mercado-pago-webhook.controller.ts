import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SWAGGER_TAGS } from '../swagger/swagger.setup';
import { MercadoPagoWebhookDto } from './dto/mercado-pago-webhook.dto';
import { MercadoPagoWebhookService } from './mercado-pago-webhook.service';

@ApiTags(SWAGGER_TAGS.clubs)
@Controller('webhooks/mercado-pago')
export class MercadoPagoWebhookController {
  constructor(private readonly webhooks: MercadoPagoWebhookService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Processes a signed Mercado Pago billing notification',
  })
  @ApiOkResponse({ description: 'Notification was accepted.' })
  @ApiUnauthorizedResponse({
    description: 'Webhook signature is invalid (`invalid_webhook_signature`).',
  })
  receive(
    @Body() payload: MercadoPagoWebhookDto,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Query('data.id') queryDataId: string | undefined,
  ): Promise<void> {
    return this.webhooks.receive(payload, signature, requestId, queryDataId);
  }
}

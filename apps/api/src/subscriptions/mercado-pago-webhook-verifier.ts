import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const MERCADO_PAGO_WEBHOOK_VERIFIER = Symbol(
  'MERCADO_PAGO_WEBHOOK_VERIFIER',
);

export interface MercadoPagoWebhookVerifier {
  verify(input: {
    signature: string;
    requestId: string;
    dataId: string;
  }): boolean;
}

@Injectable()
export class MercadoPagoHmacWebhookVerifier implements MercadoPagoWebhookVerifier {
  constructor(private readonly config: ConfigService) {}

  verify(input: {
    signature: string;
    requestId: string;
    dataId: string;
  }): boolean {
    const secret = this.config.get<string>('MERCADO_PAGO_WEBHOOK_SECRET');
    if (!secret) return false;
    const attributes = new Map(
      input.signature.split(',').map((part) => {
        const [key, value] = part.trim().split('=', 2);
        return [key, value] as const;
      }),
    );
    const timestamp = attributes.get('ts');
    const received = attributes.get('v1');
    if (
      !timestamp ||
      !received ||
      !/^[0-9]+$/.test(timestamp) ||
      !/^[a-f0-9]+$/i.test(received)
    )
      return false;
    const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${timestamp};`;
    const expected = createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');
    const receivedBuffer = Buffer.from(received, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    return (
      receivedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(receivedBuffer, expectedBuffer)
    );
  }
}

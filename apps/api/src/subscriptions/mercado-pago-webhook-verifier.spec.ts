import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoHmacWebhookVerifier } from './mercado-pago-webhook-verifier';

const secret = 'webhook-secret';
const config = { get: () => secret } as unknown as ConfigService;
const input = { requestId: 'request-123', dataId: 'payment-456' };

function signature(): string {
  const ts = '1704908010';
  const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${ts};`;
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

describe('MercadoPagoHmacWebhookVerifier', () => {
  it('accepts the documented signed manifest', () => {
    expect(
      new MercadoPagoHmacWebhookVerifier(config).verify({
        ...input,
        signature: signature(),
      }),
    ).toBe(true);
  });

  it('rejects a signature for another request or resource', () => {
    const verifier = new MercadoPagoHmacWebhookVerifier(config);
    expect(
      verifier.verify({ ...input, dataId: 'forged', signature: signature() }),
    ).toBe(false);
    expect(
      verifier.verify({ ...input, signature: 'ts=1,v1=not-a-hex-signature' }),
    ).toBe(false);
  });

  it('accepts a valid delayed retry; event idempotency, not timestamp age, blocks replay', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-15T00:00:00.000Z'));
    expect(
      new MercadoPagoHmacWebhookVerifier(config).verify({
        ...input,
        signature: signature(),
      }),
    ).toBe(true);
    jest.useRealTimers();
  });
});

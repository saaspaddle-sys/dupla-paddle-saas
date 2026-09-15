import { ConfigService } from '@nestjs/config';
import { AmbiguousPreapprovalCreationError } from './mercado-pago-preapproval.client';
import { MercadoPagoHttpPreapprovalClient } from './mercado-pago-http-preapproval.client';

const config = {
  get: <T>(key: string): T | undefined => {
    if (key === 'MERCADO_PAGO_ACCESS_TOKEN') return 'test-access-token' as T;
    return undefined;
  },
} as unknown as ConfigService;

const input = {
  reference: 'opaque-reference',
  payerEmail: 'owner@example.test',
  reason: 'test subscription',
  amount: 100,
  currencyId: 'ARS',
  backUrl: 'https://app.test/return',
};

describe('MercadoPagoHttpPreapprovalClient outcome classification', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([400, 409])(
    'keeps HTTP %i with an error body ambiguous',
    async (status) => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ message: 'provider-specific-error' }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const client = new MercadoPagoHttpPreapprovalClient(config);

      await expect(client.create(input)).rejects.toBeInstanceOf(
        AmbiguousPreapprovalCreationError,
      );
    },
  );
});

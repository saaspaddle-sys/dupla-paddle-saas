import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
  AmbiguousPreapprovalCreationError,
  DefinitivePreapprovalRejectionError,
} from './mercado-pago-preapproval.client';
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
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

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

  it('classifies only the documented validation envelope as definitive', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'payer email must differ from collector',
          error: 'bad_request',
          status: 400,
          cause: [],
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new MercadoPagoHttpPreapprovalClient(config);

    await expect(client.create(input)).rejects.toBeInstanceOf(
      DefinitivePreapprovalRejectionError,
    );
  });

  it('classifies a minimal recognized validation envelope as definitive', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: 'payer_email is invalid', status: '400' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    const client = new MercadoPagoHttpPreapprovalClient(config);

    await expect(client.create(input)).rejects.toBeInstanceOf(
      DefinitivePreapprovalRejectionError,
    );
  });

  it('logs only bounded provider codes and never sensitive rejection values', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn');
    const sensitive = {
      token: 'TEST-secret-access-token',
      email: 'owner-private@example.test',
      reference: 'private-external-reference',
      url: 'https://private.example.test/callback?secret=value',
      errorCode: '31d3de48-9664-4b8d-b31f-03b6297eb3f1',
      causeCode: 'private-external-reference-token-123',
    };
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          message: `payer_email invalid ${sensitive.email} ${sensitive.url} ${sensitive.token}`,
          error: sensitive.errorCode,
          status: 400,
          cause: [
            {
              code: sensitive.causeCode,
              description: `${sensitive.reference} ${sensitive.token}`,
            },
          ],
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new MercadoPagoHttpPreapprovalClient(config);

    await expect(client.create(input)).rejects.toBeInstanceOf(
      DefinitivePreapprovalRejectionError,
    );

    expect(warn).toHaveBeenCalledWith({
      event: 'mercado_pago_preapproval_create_rejected',
      httpStatus: 400,
      contentType: 'json',
      bodyState: 'parsed',
      providerErrorCategory: 'unknown',
      providerMessageCategory: 'invalid_payer_email',
      providerCauseCategories: ['unknown'],
      providerCauseCount: 1,
    });
    const logged = JSON.stringify(warn.mock.calls);
    for (const value of Object.values(sensitive)) {
      expect(logged).not.toContain(value);
    }
  });

  it('keeps malformed, oversized, and non-JSON 400 responses ambiguous', async () => {
    const responses = [
      new Response('not json', {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
      new Response('<html>gateway</html>', {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      }),
      new Response(
        JSON.stringify({
          message: 'x'.repeat(4097),
          error: 'bad_request',
          status: 400,
          cause: [],
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    ];
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(() => Promise.resolve(responses.shift()!));
    const client = new MercadoPagoHttpPreapprovalClient(config);

    for (let count = 0; count < 3; count += 1) {
      await expect(client.create(input)).rejects.toBeInstanceOf(
        AmbiguousPreapprovalCreationError,
      );
    }
  });

  it('normalizes the documented authorized-payment invoice without confusing invoice and payment status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 123456,
          status: 'processed',
          preapproval_id: 'preapproval-id',
          transaction_amount: '100.00',
          currency_id: 'ARS',
          external_reference: 'opaque-reference',
          date_created: '2026-09-01T00:00:00.000Z',
          payment: { id: 987654, status: 'approved' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new MercadoPagoHttpPreapprovalClient(config);

    await expect(client.getAuthorizedPayment('123456')).resolves.toEqual({
      id: '123456',
      invoiceStatus: 'processed',
      paymentStatus: 'approved',
      preapprovalId: 'preapproval-id',
      amount: '100.00',
      currencyId: 'ARS',
      externalReference: 'opaque-reference',
      paidAt: new Date('2026-09-01T00:00:00.000Z'),
    });
  });

  it('sends exactly the documented pending-preapproval body', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'preapproval-id',
          status: 'pending',
          init_point: 'https://mp.test/pay',
        }),
        { status: 201 },
      ),
    );
    const client = new MercadoPagoHttpPreapprovalClient(config);
    await client.create(input);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mercadopago.com/preapproval',
      expect.any(Object),
    );
    const request = fetchMock.mock.calls[0]?.[1];
    expect(typeof request?.body).toBe('string');
    if (typeof request?.body !== 'string') throw new Error('missing JSON body');
    expect(JSON.parse(request.body) as unknown).toEqual({
      reason: input.reason,
      external_reference: input.reference,
      payer_email: input.payerEmail,
      back_url: input.backUrl,
      status: 'pending',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: input.amount,
        currency_id: input.currencyId,
      },
    });
  });

  it('recovers only the preapproval whose external reference exactly matches', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: 'other',
              status: 'pending',
              init_point: 'https://mp.test/other',
              external_reference: 'other-reference',
            },
            {
              id: 'recovered',
              status: 'pending',
              init_point: 'https://mp.test/recovered',
              external_reference: input.reference,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const client = new MercadoPagoHttpPreapprovalClient(config);
    await expect(
      client.findPreapprovalByReference(input.reference),
    ).resolves.toEqual({
      id: 'recovered',
      status: 'pending',
      initPoint: 'https://mp.test/recovered',
    });
  });

  it('does not recover an ambiguous set of exact-reference preapprovals', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: 'one',
              status: 'pending',
              init_point: 'https://mp.test/one',
              external_reference: input.reference,
            },
            {
              id: 'two',
              status: 'pending',
              init_point: 'https://mp.test/two',
              external_reference: input.reference,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const client = new MercadoPagoHttpPreapprovalClient(config);
    await expect(
      client.findPreapprovalByReference(input.reference),
    ).resolves.toBeNull();
  });
});

import { PrismaService } from '../prisma/prisma.service';
import type { MercadoPagoPreapprovalClient } from './mercado-pago-preapproval.client';
import { MercadoPagoWebhookService } from './mercado-pago-webhook.service';

const payload = {
  id: 'notification-1',
  type: 'subscription_authorized_payment',
  data: { id: 'payment-1' },
};
const verifier = { verify: jest.fn().mockReturnValue(true) };

function hasProcessedAt(
  value: unknown,
): value is { data: { processedAt: Date } } {
  if (typeof value !== 'object' || value === null) return false;
  const data = (value as { data?: unknown }).data;
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { processedAt?: unknown }).processedAt instanceof Date
  );
}

function harness(overrides: Record<string, unknown> = {}) {
  const event = { id: 'event-1', processedAt: null };
  const updateSubscription = jest.fn();
  const updateCheckout = jest.fn();
  let processedAt: Date | undefined;
  const updateEvent = jest.fn((input: unknown) => {
    if (hasProcessedAt(input)) processedAt = input.data.processedAt;
  });
  const createEvent = jest.fn().mockResolvedValue(event);
  const tx = {
    paymentEvent: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(event),
      update: updateEvent,
    },
    subscriptionCheckout: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'checkout-1',
        subscriptionId: 'subscription-1',
        targetPlan: 'basic',
        state: 'pending',
        amount: {
          equals: (value: { toString(): string }) => value.toString() === '100',
        },
        currency: 'ARS',
        reference: 'checkout-reference',
      }),
      update: updateCheckout,
    },
    subscription: { update: updateSubscription },
  };
  const prisma = {
    paymentEvent: {
      create: createEvent,
      update: updateEvent,
    },
    $transaction: jest.fn((handler: (client: typeof tx) => Promise<unknown>) =>
      handler(tx),
    ),
    ...overrides,
  } as unknown as PrismaService;
  const provider: MercadoPagoPreapprovalClient = {
    create: jest.fn(),
    getAuthorizedPayment: jest.fn().mockResolvedValue({
      id: 'payment-1',
      status: 'approved',
      preapprovalId: 'preapproval-1',
      amount: 100,
      currencyId: 'ARS',
      externalReference: 'checkout-reference',
    }),
  };
  return {
    prisma,
    provider,
    updateSubscription,
    updateCheckout,
    updateEvent,
    processedAt: () => processedAt,
    createEvent,
  };
}

describe('MercadoPagoWebhookService', () => {
  it('activates exactly the correlated entitlement after a canonical approved charge', async () => {
    const h = harness();
    await new MercadoPagoWebhookService(h.prisma, h.provider, verifier).receive(
      payload,
      'signature',
      'request',
    );
    expect(h.updateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { plan: 'basic', status: 'active', maxTournaments: 3 },
      }),
    );
    expect(h.updateCheckout).toHaveBeenCalled();
    expect(h.updateEvent).toHaveBeenCalled();
  });

  it('does not activate when the canonical payment is not approved', async () => {
    const h = harness();
    (h.provider.getAuthorizedPayment as jest.Mock).mockResolvedValueOnce({
      id: 'payment-1',
      status: 'pending',
      preapprovalId: 'preapproval-1',
      amount: 100,
      currencyId: 'ARS',
      externalReference: 'checkout-reference',
    });
    await new MercadoPagoWebhookService(h.prisma, h.provider, verifier).receive(
      payload,
      'signature',
      'request',
    );
    expect(h.updateSubscription).not.toHaveBeenCalled();
    expect(h.updateEvent).toHaveBeenCalled();
  });

  it('does not activate a canonical payment with another checkout reference', async () => {
    const h = harness();
    (h.provider.getAuthorizedPayment as jest.Mock).mockResolvedValueOnce({
      id: 'payment-1',
      status: 'approved',
      preapprovalId: 'preapproval-1',
      amount: 100,
      currencyId: 'ARS',
      externalReference: 'another-checkout',
    });
    await new MercadoPagoWebhookService(h.prisma, h.provider, verifier).receive(
      payload,
      'signature',
      'request',
    );
    expect(h.updateSubscription).not.toHaveBeenCalled();
    expect(h.updateEvent).toHaveBeenCalled();
  });

  it('marks a definitive canonical resource mismatch processed as a no-op', async () => {
    const h = harness();
    (h.provider.getAuthorizedPayment as jest.Mock).mockResolvedValueOnce({
      id: 'another-payment',
      status: 'approved',
      preapprovalId: 'preapproval-1',
      amount: 100,
      currencyId: 'ARS',
      externalReference: 'checkout-reference',
    });
    await expect(
      new MercadoPagoWebhookService(h.prisma, h.provider, verifier).receive(
        payload,
        'signature',
        'request',
      ),
    ).resolves.toBeUndefined();
    expect(h.updateSubscription).not.toHaveBeenCalled();
    expect(h.processedAt()).toBeInstanceOf(Date);
  });

  it('does not write when the signature is invalid', async () => {
    const h = harness();
    const rejected = { verify: jest.fn().mockReturnValue(false) };
    await expect(
      new MercadoPagoWebhookService(h.prisma, h.provider, rejected).receive(
        payload,
        'bad',
        'request',
      ),
    ).rejects.toMatchObject({
      response: { code: 'invalid_webhook_signature' },
    });
    expect(h.createEvent).not.toHaveBeenCalled();
  });
});

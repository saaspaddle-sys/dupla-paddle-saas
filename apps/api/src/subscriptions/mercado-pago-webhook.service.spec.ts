import { PrismaService } from '../prisma/prisma.service';
import type { MercadoPagoPreapprovalClient } from './mercado-pago-preapproval.client';
import { MercadoPagoWebhookService } from './mercado-pago-webhook.service';

const payload = {
  id: 'notification-1',
  type: 'subscription_authorized_payment',
  data: { id: 'payment-1' },
};
const verifier = { verify: jest.fn().mockReturnValue(true) };

type SubscriptionUpdate = (input: { data: Record<string, unknown> }) => unknown;

type SubscriptionRecord = {
  id: string;
  providerPreapprovalId: string;
  plan?: string;
  currentPeriodEndsAt?: Date;
};

type FindSubscription = () => Promise<SubscriptionRecord | null>;

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
  let subscriptionUpdate: Parameters<SubscriptionUpdate>[0] | undefined;
  const updateSubscription = jest.fn(
    (input: Parameters<SubscriptionUpdate>[0]) => {
      subscriptionUpdate = input;
    },
  );
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
    subscription: {
      findFirst: jest
        .fn<ReturnType<FindSubscription>, []>()
        .mockResolvedValue(null),
      update: updateSubscription,
    },
    subscriptionPreapprovalTombstone: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
  const prisma = {
    paymentEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
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
      invoiceStatus: 'processed',
      paymentStatus: 'approved',
      preapprovalId: 'preapproval-1',
      amount: 100,
      currencyId: 'ARS',
      externalReference: 'checkout-reference',
      paidAt: new Date('2026-09-01T00:00:00.000Z'),
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
    findSubscription: tx.subscription.findFirst,
    subscriptionUpdate: () => subscriptionUpdate,
    tx,
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
    const activation = h.subscriptionUpdate();
    expect(activation?.data).toMatchObject({
      plan: 'basic',
      status: 'active',
      maxTournaments: 3,
    });
    expect(h.updateCheckout).toHaveBeenCalled();
    expect(h.updateEvent).toHaveBeenCalled();
  });

  it('does not activate when the canonical payment is not approved', async () => {
    const h = harness();
    (h.provider.getAuthorizedPayment as jest.Mock).mockResolvedValueOnce({
      id: 'payment-1',
      invoiceStatus: 'pending',
      paymentStatus: 'pending',
      preapprovalId: 'preapproval-1',
      amount: 100,
      currencyId: 'ARS',
      externalReference: 'checkout-reference',
      paidAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    await expect(
      new MercadoPagoWebhookService(h.prisma, h.provider, verifier).receive(
        payload,
        'signature',
        'request',
      ),
    ).rejects.toMatchObject({
      response: { code: 'billing_provider_unavailable' },
    });
    expect(h.updateSubscription).not.toHaveBeenCalled();
    expect(h.updateEvent).toHaveBeenCalled();
  });

  it('marks a processed rejected renewal terminal and past due', async () => {
    const h = harness();
    h.findSubscription.mockResolvedValue({
      id: 'subscription-1',
      providerPreapprovalId: 'preapproval-1',
    });
    (h.provider.getAuthorizedPayment as jest.Mock).mockResolvedValueOnce({
      id: 'payment-1',
      invoiceStatus: 'processed',
      paymentStatus: 'rejected',
      preapprovalId: 'preapproval-1',
      amount: '100.00',
      currencyId: 'ARS',
      externalReference: 'checkout-reference',
      paidAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    await expect(
      new MercadoPagoWebhookService(h.prisma, h.provider, verifier).receive(
        payload,
        'signature',
        'request',
      ),
    ).resolves.toBeUndefined();
    expect(h.updateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'past_due', providerStatus: 'processed' },
      }),
    );
    expect(h.processedAt()).toBeInstanceOf(Date);
  });

  it('does not activate a canonical payment with another checkout reference', async () => {
    const h = harness();
    (h.provider.getAuthorizedPayment as jest.Mock).mockResolvedValueOnce({
      id: 'payment-1',
      invoiceStatus: 'processed',
      paymentStatus: 'approved',
      preapprovalId: 'preapproval-1',
      amount: 100,
      currencyId: 'ARS',
      externalReference: 'another-checkout',
      paidAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    await expect(
      new MercadoPagoWebhookService(h.prisma, h.provider, verifier).receive(
        payload,
        'signature',
        'request',
      ),
    ).rejects.toMatchObject({
      response: { code: 'billing_provider_unavailable' },
    });
    expect(h.updateSubscription).not.toHaveBeenCalled();
    expect(h.updateEvent).toHaveBeenCalled();
  });

  it('marks a definitive canonical resource mismatch processed as a no-op', async () => {
    const h = harness();
    (h.provider.getAuthorizedPayment as jest.Mock).mockResolvedValueOnce({
      id: 'another-payment',
      invoiceStatus: 'processed',
      paymentStatus: 'approved',
      preapprovalId: 'preapproval-1',
      amount: 100,
      currencyId: 'ARS',
      externalReference: 'checkout-reference',
      paidAt: new Date('2026-09-01T00:00:00.000Z'),
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

  it('never shortens a later paid-through period when an old invoice arrives', async () => {
    const h = harness();
    h.findSubscription.mockResolvedValue({
      id: 'subscription-1',
      providerPreapprovalId: 'preapproval-1',
      plan: 'basic',
      currentPeriodEndsAt: new Date('2026-11-01T00:00:00.000Z'),
    });
    await new MercadoPagoWebhookService(h.prisma, h.provider, verifier).receive(
      payload,
      'signature',
      'request',
    );
    expect(h.subscriptionUpdate()?.data).toMatchObject({
      currentPeriodEndsAt: new Date('2026-11-01T00:00:00.000Z'),
    });
  });

  it('terminally audits a late payment for a cancelled provider mandate', async () => {
    const h = harness();
    h.findSubscription.mockResolvedValue(null);
    h.tx.subscriptionCheckout.findFirst.mockResolvedValue(null);
    h.tx.subscriptionPreapprovalTombstone.findUnique.mockResolvedValue({
      subscriptionId: 'subscription-1',
    });
    await expect(
      new MercadoPagoWebhookService(h.prisma, h.provider, verifier).receive(
        payload,
        'signature',
        'request',
      ),
    ).resolves.toBeUndefined();
    expect(h.processedAt()).toBeInstanceOf(Date);
  });

  it('expires active entitlements whose paid period ended without a failure webhook', async () => {
    let expirationUpdate: { where: { status?: { in: string[] } } } | undefined;
    const updateMany = jest.fn(
      (input: { where: { status?: { in: string[] } } }) => {
        expirationUpdate = input;
        return Promise.resolve({ count: 1 });
      },
    );
    const prisma = {
      subscription: { updateMany },
    } as unknown as PrismaService;
    const service = new MercadoPagoWebhookService(
      prisma,
      { create: jest.fn(), getAuthorizedPayment: jest.fn() },
      verifier,
    );
    await expect(
      service.expirePastDueEntitlements(new Date('2026-10-01T00:00:00.000Z')),
    ).resolves.toBe(1);
    expect(expirationUpdate?.where.status).toEqual({
      in: ['active', 'past_due'],
    });
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

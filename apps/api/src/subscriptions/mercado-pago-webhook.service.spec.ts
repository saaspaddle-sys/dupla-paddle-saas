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
type CheckoutUpdate = (input: { data: Record<string, unknown> }) => unknown;

type SubscriptionRecord = {
  id: string;
  providerPreapprovalId: string;
  plan?: string;
  currentPeriodEndsAt?: Date;
  pendingPlan?: string | null;
  pendingPlanAmount?: { equals(value: { toString(): string }): boolean } | null;
  pendingPlanCurrency?: string | null;
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
    $executeRaw: jest.fn(),
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
    getPreapproval: jest.fn(),
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

  it('applies a scheduled Pro upgrade only after a matching approved renewal', async () => {
    const h = harness({
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 'subscription-1' }),
      },
    });
    h.tx.subscriptionCheckout.findFirst.mockResolvedValue(null);
    h.findSubscription.mockResolvedValue({
      id: 'subscription-1',
      providerPreapprovalId: 'preapproval-1',
      plan: 'basic',
      currentPeriodEndsAt: new Date('2026-10-01T00:00:00.000Z'),
      pendingPlan: 'pro',
      pendingPlanAmount: {
        equals: (value) => value.toString() === '250',
      },
      pendingPlanCurrency: 'ARS',
    });
    (h.provider.getAuthorizedPayment as jest.Mock).mockResolvedValueOnce({
      id: 'payment-1',
      invoiceStatus: 'processed',
      paymentStatus: 'approved',
      preapprovalId: 'preapproval-1',
      amount: '250.00',
      currencyId: 'ARS',
      externalReference: 'subscription-reference',
      paidAt: new Date('2026-10-01T00:00:00.000Z'),
    });

    await new MercadoPagoWebhookService(h.prisma, h.provider, verifier).receive(
      payload,
      'signature',
      'request',
    );

    expect(h.subscriptionUpdate()?.data).toMatchObject({
      plan: 'pro',
      maxTournaments: 12,
      pendingPlan: null,
      pendingPlanAmount: null,
      pendingPlanCurrency: null,
      pendingPlanConfirmedAt: null,
    });
  });

  it('keeps Basic and the pending upgrade when an old-priced renewal arrives', async () => {
    const h = harness({
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 'subscription-1' }),
      },
    });
    h.tx.subscriptionCheckout.findFirst.mockResolvedValue(null);
    h.findSubscription.mockResolvedValue({
      id: 'subscription-1',
      providerPreapprovalId: 'preapproval-1',
      plan: 'basic',
      currentPeriodEndsAt: new Date('2026-10-01T00:00:00.000Z'),
      pendingPlan: 'pro',
      pendingPlanAmount: {
        equals: (value) => value.toString() === '250',
      },
      pendingPlanCurrency: 'ARS',
    });

    await new MercadoPagoWebhookService(h.prisma, h.provider, verifier).receive(
      payload,
      'signature',
      'request',
    );

    expect(h.subscriptionUpdate()?.data).toMatchObject({
      plan: 'basic',
      maxTournaments: 3,
    });
    expect(h.subscriptionUpdate()?.data).not.toHaveProperty('pendingPlan');
  });

  it('keeps Basic when a matching payment does not extend the paid period', async () => {
    const h = harness({
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 'subscription-1' }),
      },
    });
    h.tx.subscriptionCheckout.findFirst.mockResolvedValue(null);
    h.findSubscription.mockResolvedValue({
      id: 'subscription-1',
      providerPreapprovalId: 'preapproval-1',
      plan: 'basic',
      currentPeriodEndsAt: new Date('2026-12-01T00:00:00.000Z'),
      pendingPlan: 'pro',
      pendingPlanAmount: {
        equals: (value) => value.toString() === '250',
      },
      pendingPlanCurrency: 'ARS',
    });
    (h.provider.getAuthorizedPayment as jest.Mock).mockResolvedValueOnce({
      id: 'payment-1',
      invoiceStatus: 'processed',
      paymentStatus: 'approved',
      preapprovalId: 'preapproval-1',
      amount: '250.00',
      currencyId: 'ARS',
      externalReference: 'subscription-reference',
      paidAt: new Date('2026-10-01T00:00:00.000Z'),
    });

    await new MercadoPagoWebhookService(h.prisma, h.provider, verifier).receive(
      payload,
      'signature',
      'request',
    );

    expect(h.subscriptionUpdate()?.data).toMatchObject({ plan: 'basic' });
    expect(h.subscriptionUpdate()?.data).not.toHaveProperty('pendingPlan');
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

  it('expires a correlated pending onboarding checkout after a terminal rejection', async () => {
    const h = harness();
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

    expect(h.updateSubscription).not.toHaveBeenCalled();
    expect(h.updateCheckout).toHaveBeenCalledWith({
      where: { id: 'checkout-1' },
      data: { state: 'expired', providerStatus: 'processed' },
    });
    expect(h.processedAt()).toBeInstanceOf(Date);
  });

  it('does not expire a pending onboarding checkout when a rejected payment fails correlation', async () => {
    const h = harness();
    (h.provider.getAuthorizedPayment as jest.Mock).mockResolvedValueOnce({
      id: 'payment-1',
      invoiceStatus: 'processed',
      paymentStatus: 'rejected',
      preapprovalId: 'preapproval-1',
      amount: '100.00',
      currencyId: 'ARS',
      externalReference: 'another-checkout-reference',
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
    expect(h.updateCheckout).not.toHaveBeenCalled();
    expect(h.processedAt()).toBeInstanceOf(Date);
  });

  it('does not infer a cancelled mandate from a recycling rejected invoice', async () => {
    const h = harness();
    (h.provider.getAuthorizedPayment as jest.Mock).mockResolvedValueOnce({
      id: 'payment-1',
      invoiceStatus: 'recycling',
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
    ).rejects.toMatchObject({
      response: { code: 'billing_provider_unavailable' },
    });

    expect(h.updateCheckout).not.toHaveBeenCalled();
    expect(h.processedAt()).toBeUndefined();
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

  it('expires only past-due or mandate-free entitlements through the generic path', async () => {
    let expirationUpdate: { where: { OR?: unknown } } | undefined;
    const updateMany = jest.fn((input: { where: { OR?: unknown } }) => {
      expirationUpdate = input;
      return Promise.resolve({ count: 1 });
    });
    const prisma = {
      subscription: { updateMany },
    } as unknown as PrismaService;
    const service = new MercadoPagoWebhookService(
      prisma,
      {
        create: jest.fn(),
        getAuthorizedPayment: jest.fn(),
        getPreapproval: jest.fn(),
      },
      verifier,
    );
    await expect(
      service.expirePastDueEntitlements(new Date('2026-10-01T00:00:00.000Z')),
    ).resolves.toBe(1);
    expect(expirationUpdate?.where.OR).toEqual([
      { status: 'past_due' },
      { status: 'active', providerPreapprovalId: null },
    ]);
  });

  it('does not finalize after resume wins the lifecycle lock', async () => {
    const cancelPreapproval = jest.fn();
    const update = jest.fn();
    const tx = {
      $executeRaw: jest.fn(),
      subscription: {
        // The runner saw paused before waiting for its lock; resume committed
        // authorized before this transaction obtained that same lock.
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          providerPreapprovalId: 'preapproval-1',
          providerStatus: 'authorized',
          currentPeriodEndsAt: new Date('2026-09-01T00:00:00.000Z'),
        }),
        update,
      },
      subscriptionPreapprovalTombstone: { upsert: jest.fn() },
    };
    const prisma = {
      subscription: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'subscription-1', providerPreapprovalId: 'preapproval-1' },
          ]),
      },
      $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
        handler(tx as never),
      ),
    } as unknown as PrismaService;
    const service = new MercadoPagoWebhookService(
      prisma,
      {
        create: jest.fn(),
        getAuthorizedPayment: jest.fn(),
        getPreapproval: jest.fn(),
        cancelPreapproval,
      },
      verifier,
    );

    await expect(
      service.finalizeExpiredPausedSubscriptions(
        new Date('2026-10-01T00:00:00.000Z'),
      ),
    ).resolves.toBe(0);

    expect(cancelPreapproval).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it('recovers a correlated approved pending checkout without creating a payment event', async () => {
    const checkout = {
      id: 'checkout-recovery',
      subscriptionId: 'subscription-1',
      provider: 'mercado_pago',
      providerPreapprovalId: 'preapproval-1',
      state: 'pending',
      amount: { equals: () => true },
      currency: 'ARS',
      reference: 'checkout-reference',
    };
    let subscriptionUpdateInput: Parameters<SubscriptionUpdate>[0] | undefined;
    const updateSubscription = jest.fn(
      (input: Parameters<SubscriptionUpdate>[0]) => {
        subscriptionUpdateInput = input;
      },
    );
    let checkoutUpdateInput: Parameters<CheckoutUpdate>[0] | undefined;
    const updateCheckout = jest.fn((input: Parameters<CheckoutUpdate>[0]) => {
      checkoutUpdateInput = input;
    });
    const tx = {
      subscriptionCheckout: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(checkout),
        update: updateCheckout,
      },
      paymentEvent: { findFirst: jest.fn().mockResolvedValue(null) },
      subscription: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'subscription-1',
          plan: 'free',
          currentPeriodEndsAt: null,
        }),
        update: updateSubscription,
      },
    };
    const prisma = {
      subscriptionCheckout: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([checkout])
          .mockResolvedValueOnce([]),
      },
      paymentEvent: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(
        (handler: (client: typeof tx) => Promise<unknown>) => handler(tx),
      ),
    } as unknown as PrismaService;
    const provider: MercadoPagoPreapprovalClient = {
      create: jest.fn(),
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
      findAuthorizedPaymentsByPreapproval: jest.fn().mockResolvedValue([
        {
          id: 'invoice-1',
          invoiceStatus: 'processed',
          paymentStatus: 'approved',
          preapprovalId: 'preapproval-1',
          amount: '100.00',
          currencyId: 'ARS',
          externalReference: 'checkout-reference',
          paidAt: new Date('2026-09-01T00:00:00.000Z'),
        },
      ]),
    };
    const service = new MercadoPagoWebhookService(prisma, provider, verifier);

    await expect(
      service.reconcilePendingCheckoutsWithoutPaymentEvents(),
    ).resolves.toBe(1);
    expect(updateSubscription).toHaveBeenCalledTimes(1);
    expect(subscriptionUpdateInput).toMatchObject({
      data: { status: 'active' },
    });
    expect(updateCheckout).toHaveBeenCalledTimes(1);
    expect(checkoutUpdateInput).toMatchObject({
      data: { state: 'completed' },
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

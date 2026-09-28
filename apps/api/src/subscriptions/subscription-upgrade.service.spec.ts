import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type Subscription } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MercadoPagoPreapprovalClient } from './mercado-pago-preapproval.client';
import { SubscriptionUpgradeService } from './subscription-upgrade.service';

const periodStartedAt = new Date('2099-09-01T03:00:00.000Z');
const periodEndsAt = new Date('2099-10-01T03:00:00.000Z');

const config = {
  get: (key: string) =>
    ({
      MERCADO_PAGO_PRO_AMOUNT: '250',
      MERCADO_PAGO_CURRENCY: 'ARS',
      MERCADO_PAGO_BACK_URL: 'https://app.test/return',
      MERCADO_PAGO_WEBHOOK_URL: 'https://api.test/webhooks/mercado-pago',
    })[key],
} as ConfigService;

function basicSubscription(): Subscription {
  return {
    id: 'subscription-id',
    userId: 'user-id',
    plan: 'basic',
    status: 'active',
    maxTournaments: 3,
    providerPreapprovalId: 'preapproval-id',
    providerStatus: 'authorized',
    pausedAt: null,
    currentPeriodStartedAt: periodStartedAt,
    currentPeriodEndsAt: periodEndsAt,
    currentPeriodAmount: new Prisma.Decimal('100.00'),
    currentPeriodCurrency: 'ARS',
    pendingPlan: null,
    pendingPlanAmount: null,
    pendingPlanCurrency: null,
    pendingPlanConfirmedAt: null,
    pendingPlanEffectiveAt: null,
    pendingPlanPaidAt: null,
    createdAt: periodStartedAt,
    updatedAt: periodStartedAt,
  };
}

describe('SubscriptionUpgradeService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2099-09-16T03:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('quotes only the remaining portion of the verified paid period', async () => {
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue(basicSubscription()),
      },
      subscriptionUpgrade: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new SubscriptionUpgradeService(
      prisma,
      config,
      {} as MercadoPagoPreapprovalClient,
    );

    await expect(service.quote('user-id')).resolves.toMatchObject({
      amount: '75.00',
      recurringAmount: '250.00',
      currency: 'ARS',
      periodEndsAt,
    });
  });

  it('keeps the quoted amount stable throughout the billing day', async () => {
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue(basicSubscription()),
      },
      subscriptionUpgrade: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new SubscriptionUpgradeService(
      prisma,
      config,
      {} as MercadoPagoPreapprovalClient,
    );

    jest.setSystemTime(new Date('2099-09-16T03:00:00.000Z'));
    const morning = await service.quote('user-id');
    jest.setSystemTime(new Date('2099-09-17T02:59:59.999Z'));
    const evening = await service.quote('user-id');
    jest.setSystemTime(new Date('2099-09-17T03:00:00.000Z'));
    const nextDay = await service.quote('user-id');

    expect(morning.amount).toBe('75.00');
    expect(evening.amount).toBe(morning.amount);
    expect(nextDay.amount).toBe('70.00');
  });

  it('never charges more than the full price difference on the first paid day', async () => {
    const subscription = {
      ...basicSubscription(),
      currentPeriodStartedAt: new Date('2099-09-01T18:00:00.000Z'),
    };
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription) },
      subscriptionUpgrade: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new SubscriptionUpgradeService(
      prisma,
      config,
      {} as MercadoPagoPreapprovalClient,
    );

    jest.setSystemTime(new Date('2099-09-01T18:00:01.000Z'));
    await expect(service.quote('user-id')).resolves.toMatchObject({
      amount: '150.00',
    });
  });

  it.each([
    ['28-day month', '2099-02-01', '2099-03-01', '2099-02-15', '75.00'],
    ['leap February', '2096-02-01', '2096-03-01', '2096-02-15', '77.59'],
    ['31-day month', '2099-07-01', '2099-08-01', '2099-07-16', '77.42'],
  ])(
    'uses the actual duration for a %s',
    async (_label, start, end, day, amount) => {
      const subscription = {
        ...basicSubscription(),
        currentPeriodStartedAt: new Date(`${start}T03:00:00.000Z`),
        currentPeriodEndsAt: new Date(`${end}T03:00:00.000Z`),
      };
      const prisma = {
        subscription: { findUnique: jest.fn().mockResolvedValue(subscription) },
        subscriptionUpgrade: { findFirst: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService;
      const service = new SubscriptionUpgradeService(
        prisma,
        config,
        {} as MercadoPagoPreapprovalClient,
      );

      jest.setSystemTime(new Date(`${day}T03:00:00.000Z`));
      await expect(service.quote('user-id')).resolves.toMatchObject({ amount });
      jest.setSystemTime(new Date(`${day}T23:59:59.999Z`));
      await expect(service.quote('user-id')).resolves.toMatchObject({ amount });
    },
  );

  it('quotes the final partial day but not the expired paid period', async () => {
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue(basicSubscription()),
      },
      subscriptionUpgrade: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new SubscriptionUpgradeService(
      prisma,
      config,
      {} as MercadoPagoPreapprovalClient,
    );

    jest.setSystemTime(new Date(periodEndsAt.getTime() - 1));
    await expect(service.quote('user-id')).resolves.toMatchObject({
      amount: '5.00',
    });
    jest.setSystemTime(periodEndsAt);
    await expect(service.quote('user-id')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('does not invent proration from an unverified period charge', async () => {
    const subscription = { ...basicSubscription(), currentPeriodAmount: null };
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription) },
      subscriptionUpgrade: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new SubscriptionUpgradeService(
      prisma,
      config,
      {} as MercadoPagoPreapprovalClient,
    );

    await expect(service.quote('user-id')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('reserves the one-time preference before contacting Mercado Pago', async () => {
    const subscription = basicSubscription();
    const create = jest.fn().mockImplementation(
      ({
        data,
      }: {
        data: {
          reference: string;
          amount: string;
          recurringAmount: string;
          currency: string;
          periodStartedAt: Date;
          periodEndsAt: Date;
        };
      }) => ({
        id: 'upgrade-id',
        ...data,
        state: 'creating',
        amount: new Prisma.Decimal(data.amount),
        recurringAmount: new Prisma.Decimal(data.recurringAmount),
      }),
    );
    const update = jest.fn().mockImplementation(
      ({
        data,
      }: {
        data: {
          preferenceId: string;
          checkoutUrl: string;
          state: string;
        };
      }) => ({
        id: 'upgrade-id',
        reference: 'upgrade-reference',
        amount: new Prisma.Decimal('75'),
        recurringAmount: new Prisma.Decimal('250'),
        currency: 'ARS',
        periodEndsAt,
        ...data,
      }),
    );
    const tx = {
      $executeRaw: jest.fn(),
      subscription: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(subscription),
      },
      subscriptionUpgrade: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    };
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          id: subscription.id,
          user: { email: 'owner@test.local' },
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(subscription),
      },
      subscriptionUpgrade: { update },
      $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
        handler(tx as never),
      ),
    } as unknown as PrismaService;
    const createPreference = jest
      .fn()
      .mockImplementation(({ reference }: { reference: string }) => {
        expect(create).toHaveBeenCalledTimes(1);
        return {
          id: 'preference-id',
          reference,
          checkoutUrl: 'https://mercadopago.test/checkout',
        };
      });
    const provider = {
      createUpgradePreference: createPreference,
      findUpgradePreferenceByReference: jest.fn(),
    } as unknown as MercadoPagoPreapprovalClient;
    const service = new SubscriptionUpgradeService(prisma, config, provider);

    await expect(
      service.createCheckout('user-id', '75.00'),
    ).resolves.toMatchObject({
      targetPlan: 'pro',
      amount: '75.00',
      checkoutUrl: 'https://mercadopago.test/checkout',
      reused: false,
    });
    const [updateInput] = update.mock.calls[0] as [
      { data: { preferenceId: string; state: string } },
    ];
    expect(updateInput.data.preferenceId).toBe('preference-id');
    expect(updateInput.data.state).toBe('pending');
  });

  it('rejects a stale displayed price before reserving or contacting the provider', async () => {
    const subscription = basicSubscription();
    const create = jest.fn();
    const tx = {
      $executeRaw: jest.fn(),
      subscription: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(subscription),
      },
      subscriptionUpgrade: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    };
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          id: subscription.id,
          user: { email: 'owner@test.local' },
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(subscription),
      },
      $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
        handler(tx as never),
      ),
    } as unknown as PrismaService;
    const createUpgradePreference = jest.fn();
    const provider = {
      createUpgradePreference,
      findUpgradePreferenceByReference: jest.fn(),
    } as unknown as MercadoPagoPreapprovalClient;
    const service = new SubscriptionUpgradeService(prisma, config, provider);

    jest.setSystemTime(new Date('2099-09-17T03:00:00.000Z'));
    await expect(
      service.createCheckout('user-id', '75.00'),
    ).rejects.toMatchObject({
      response: { code: 'upgrade_quote_changed' },
    });
    expect(create).not.toHaveBeenCalled();
    expect(createUpgradePreference).not.toHaveBeenCalled();
  });

  it('keeps an existing checkout at its reserved amount after midnight', async () => {
    const subscription = basicSubscription();
    const existing = {
      id: 'upgrade-id',
      subscriptionId: subscription.id,
      preapprovalId: subscription.providerPreapprovalId,
      periodStartedAt,
      periodEndsAt,
      state: 'pending',
      reference: 'upgrade-reference',
      checkoutUrl: 'https://mercadopago.test/checkout',
      amount: new Prisma.Decimal('75.00'),
      recurringAmount: new Prisma.Decimal('250.00'),
      currency: 'ARS',
    };
    const tx = {
      $executeRaw: jest.fn(),
      subscription: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(subscription),
      },
      subscriptionUpgrade: { findFirst: jest.fn().mockResolvedValue(existing) },
    };
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          ...subscription,
          user: { email: 'owner@test.local' },
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(subscription),
      },
      subscriptionUpgrade: { findFirst: jest.fn().mockResolvedValue(existing) },
      $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
        handler(tx as never),
      ),
    } as unknown as PrismaService;
    const createUpgradePreference = jest.fn();
    const provider = {
      createUpgradePreference,
      findUpgradePreferenceByReference: jest.fn(),
    } as unknown as MercadoPagoPreapprovalClient;
    const service = new SubscriptionUpgradeService(prisma, config, provider);

    jest.setSystemTime(new Date('2099-09-17T03:00:00.000Z'));
    await expect(service.quote('user-id')).resolves.toMatchObject({
      amount: '75.00',
    });
    await expect(
      service.createCheckout('user-id', '75.00'),
    ).resolves.toMatchObject({
      amount: '75.00',
      reused: true,
    });
    expect(createUpgradePreference).not.toHaveBeenCalled();
  });

  it('keeps an ambiguous preference reservation for recovery rather than creating a second checkout', async () => {
    const subscription = basicSubscription();
    const tx = {
      $executeRaw: jest.fn(),
      subscription: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(subscription),
      },
      subscriptionUpgrade: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'upgrade-id',
          reference: 'upgrade-reference',
          state: 'creating',
          amount: new Prisma.Decimal('75'),
          recurringAmount: new Prisma.Decimal('250'),
          currency: 'ARS',
          periodStartedAt,
          periodEndsAt,
        }),
      },
    };
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          id: subscription.id,
          user: { email: 'owner@test.local' },
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(subscription),
      },
      $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
        handler(tx as never),
      ),
    } as unknown as PrismaService;
    const findPreference = jest.fn().mockResolvedValue(null);
    const provider = {
      createUpgradePreference: jest
        .fn()
        .mockRejectedValue(new Error('timeout')),
      findUpgradePreferenceByReference: findPreference,
    } as unknown as MercadoPagoPreapprovalClient;
    const service = new SubscriptionUpgradeService(prisma, config, provider);

    await expect(
      service.createCheckout('user-id', '75.00'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(tx.subscriptionUpgrade.create).toHaveBeenCalledTimes(1);
    expect(findPreference).toHaveBeenCalledWith('upgrade-reference');
  });

  it('updates the recurring amount before granting Pro for an approved correlated payment', async () => {
    const subscription = basicSubscription();
    const upgrade = {
      id: 'upgrade-id',
      subscriptionId: subscription.id,
      reference: 'upgrade-reference',
      preapprovalId: 'preapproval-id',
      periodStartedAt,
      periodEndsAt,
      amount: new Prisma.Decimal('75'),
      recurringAmount: new Prisma.Decimal('250'),
      currency: 'ARS',
      state: 'pending' as 'pending' | 'paid' | 'applied',
      paymentId: null as string | null,
    };
    const updateUpgrade = jest.fn().mockImplementation(({ data }) => {
      Object.assign(upgrade, data);
      return upgrade;
    });
    const updateSubscription = jest.fn();
    const tx = {
      $executeRaw: jest.fn(),
      subscription: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(subscription),
        update: updateSubscription,
      },
      subscriptionUpgrade: {
        findUniqueOrThrow: jest.fn().mockImplementation(() => upgrade),
        update: updateUpgrade,
      },
      paymentEvent: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ processedAt: null }),
        update: jest.fn(),
      },
    };
    const prisma = {
      subscriptionUpgrade: {
        findUnique: jest.fn().mockResolvedValue(upgrade),
        findUniqueOrThrow: jest.fn().mockImplementation(() => upgrade),
      },
      subscription: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(subscription),
      },
      $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
        handler(tx as never),
      ),
    } as unknown as PrismaService;
    const updateRecurringAmount = jest.fn().mockImplementation(() => {
      expect(updateSubscription).not.toHaveBeenCalled();
    });
    const provider = {
      getUpgradePayment: jest.fn().mockResolvedValue({
        id: 'payment-id',
        status: 'approved',
        reference: upgrade.reference,
        amount: '75.00',
        currencyId: 'ARS',
        approvedAt: new Date(),
      }),
      updateRecurringAmount,
    } as unknown as MercadoPagoPreapprovalClient;
    const service = new SubscriptionUpgradeService(prisma, config, provider);

    await service.processPaymentEvent('event-id', 'payment-id');

    expect(updateRecurringAmount).toHaveBeenCalledWith('preapproval-id', {
      amount: 250,
      currencyId: 'ARS',
    });
    expect(updateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { plan: 'pro', maxTournaments: 12 },
      }),
    );
    expect(upgrade.state).toBe('applied');
  });

  it('acknowledges an unrelated signed payment without retrying it forever', async () => {
    const updateEvent = jest.fn<
      void,
      [{ where: { id: string }; data: { processedAt: Date } }]
    >();
    const prisma = {
      subscriptionUpgrade: { findUnique: jest.fn().mockResolvedValue(null) },
      paymentEvent: { update: updateEvent },
    } as unknown as PrismaService;
    const provider = {
      getUpgradePayment: jest.fn().mockResolvedValue({
        id: 'unrelated-payment',
        status: 'approved',
        reference: 'unrelated-reference',
        amount: '10.00',
        currencyId: 'ARS',
        approvedAt: new Date(),
      }),
    } as unknown as MercadoPagoPreapprovalClient;
    const service = new SubscriptionUpgradeService(prisma, config, provider);

    await expect(
      service.processPaymentEvent('event-id', 'unrelated-payment'),
    ).resolves.toBeUndefined();
    expect(updateEvent).toHaveBeenCalledTimes(1);
    const input = updateEvent.mock.calls[0][0];
    expect(input.where.id).toBe('event-id');
    expect(input.data.processedAt).toBeInstanceOf(Date);
  });
});

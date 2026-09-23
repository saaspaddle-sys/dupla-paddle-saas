import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  DefinitivePreapprovalRejectionError,
  AmbiguousPreapprovalCreationError,
  type CreatedPreapproval,
  type MercadoPagoPreapprovalClient,
} from './mercado-pago-preapproval.client';
import { SubscriptionsService } from './subscriptions.service';

const config = {
  get: <T>(key: string): T | undefined => {
    const values: Record<string, string> = {
      MERCADO_PAGO_ACCESS_TOKEN: 'test-access-token',
      MERCADO_PAGO_BASIC_AMOUNT: '100',
      MERCADO_PAGO_PRO_AMOUNT: '250',
      MERCADO_PAGO_CURRENCY: 'ARS',
      MERCADO_PAGO_BACK_URL: 'https://app.test/return',
      MERCADO_PAGO_WEBHOOK_URL: 'https://api.test/webhooks/mercado-pago',
    };
    return values[key] as T | undefined;
  },
} as unknown as ConfigService;

function subscription() {
  return {
    id: 'subscription-id',
    user: { email: 'owner@example.test' },
  };
}

async function expectRecovery(
  promise: Promise<unknown>,
  message: string,
): Promise<void> {
  try {
    await promise;
    fail('expected checkout recovery failure');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    if (error instanceof ServiceUnavailableException) {
      expect(error.getResponse()).toEqual({
        code: 'billing_checkout_recovery_required',
        message,
      });
    }
  }
}

describe('SubscriptionsService checkout durability', () => {
  it('pauses renewal without removing the paid entitlement', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const pausePreapproval = jest.fn().mockResolvedValue(undefined);
    const tx = {
      $executeRaw: jest.fn(),
      subscription: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          providerPreapprovalId: 'preapproval-id',
          providerStatus: 'authorized',
        }),
        update,
      },
    };
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({ id: 'subscription-id' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          providerPreapprovalId: 'preapproval-id',
          providerStatus: 'authorized',
        }),
      },
      $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
        handler(tx as never),
      ),
    } as unknown as PrismaService;
    const service = new SubscriptionsService(prisma, config, {
      create: jest.fn(),
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
      pausePreapproval,
    });

    await service.cancelMine('user-id');

    expect(pausePreapproval).toHaveBeenCalledWith('preapproval-id');
    const [updateInput] = update.mock.calls[0] as [
      { data: { providerStatus: string; pausedAt: Date } },
    ];
    expect(updateInput.data.providerStatus).toBe('paused');
    expect(updateInput.data.pausedAt).toBeInstanceOf(Date);
  });

  it('resumes the same paused mandate without creating a checkout', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const resumePreapproval = jest.fn().mockResolvedValue(undefined);
    const createCheckout = jest.fn();
    const tx = {
      $executeRaw: jest.fn(),
      subscription: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          providerPreapprovalId: 'preapproval-id',
          providerStatus: 'paused',
          currentPeriodEndsAt: new Date('2099-10-01T00:00:00Z'),
        }),
        update,
      },
    };
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({ id: 'subscription-id' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          providerPreapprovalId: 'preapproval-id',
          providerStatus: 'paused',
          currentPeriodEndsAt: new Date('2099-10-01T00:00:00Z'),
        }),
      },
      subscriptionCheckout: { create: createCheckout },
      $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
        handler(tx as never),
      ),
    } as unknown as PrismaService;
    const service = new SubscriptionsService(prisma, config, {
      create: jest.fn(),
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
      resumePreapproval,
    });

    await service.resumeMine('user-id');

    expect(resumePreapproval).toHaveBeenCalledWith('preapproval-id');
    const [updateInput] = update.mock.calls[0] as [
      { data: { providerStatus: string; pausedAt: null } },
    ];
    expect(updateInput.data).toEqual({
      providerStatus: 'authorized',
      pausedAt: null,
    });
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('does not mutate local state when pausing fails at Mercado Pago', async () => {
    const update = jest.fn();
    const tx = {
      $executeRaw: jest.fn(),
      subscription: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          providerPreapprovalId: 'preapproval-id',
          providerStatus: 'authorized',
        }),
        update,
      },
    };
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({ id: 'subscription-id' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          providerPreapprovalId: 'preapproval-id',
          providerStatus: 'authorized',
        }),
      },
      $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
        handler(tx as never),
      ),
    } as unknown as PrismaService;
    const service = new SubscriptionsService(prisma, config, {
      create: jest.fn(),
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
      pausePreapproval: jest.fn().mockRejectedValue(new Error('offline')),
    });

    await expect(service.cancelMine('user-id')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(update).not.toHaveBeenCalled();
  });
  it('blocks a new checkout while the previous mandate is paused', async () => {
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'subscription-id',
          providerPreapprovalId: 'preapproval-id',
          providerStatus: 'paused',
          user: { email: 'owner@example.test' },
        }),
      },
    } as unknown as PrismaService;
    const createPreapproval = jest.fn();
    const provider: MercadoPagoPreapprovalClient = {
      create: createPreapproval,
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
    };
    const service = new SubscriptionsService(prisma, config, provider);

    await expect(
      service.createCheckout('user-id', 'basic'),
    ).rejects.toMatchObject({
      response: {
        code: 'paused_subscription_must_be_resumed',
        message:
          'renewal is paused; resume it or wait until the paid period ends before starting a new checkout',
      },
    });
    expect(createPreapproval).not.toHaveBeenCalled();
  });

  it('directs an active Basic subscriber to the upgrade endpoint instead of cancellation', async () => {
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'subscription-id',
          plan: 'basic',
          providerPreapprovalId: 'preapproval-id',
          providerStatus: 'authorized',
          user: { email: 'owner@example.test' },
        }),
      },
    } as unknown as PrismaService;
    const createPreapproval = jest.fn();
    const service = new SubscriptionsService(prisma, config, {
      create: createPreapproval,
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
    });

    await expect(
      service.createCheckout('user-id', 'pro'),
    ).rejects.toMatchObject({
      response: {
        code: 'subscription_upgrade_required',
        message:
          'Basic is already active; use POST /subscriptions/me/upgrade to schedule Pro for the next renewal',
      },
    });
    expect(createPreapproval).not.toHaveBeenCalled();
  });

  it('explains that cancelling renewal does not immediately permit another checkout', async () => {
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'subscription-id',
          plan: 'pro',
          providerPreapprovalId: 'preapproval-id',
          providerStatus: 'authorized',
          user: { email: 'owner@example.test' },
        }),
      },
    } as unknown as PrismaService;
    const service = new SubscriptionsService(prisma, config, {
      create: jest.fn(),
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
    });

    await expect(
      service.createCheckout('user-id', 'basic'),
    ).rejects.toMatchObject({
      response: {
        code: 'active_subscription_must_be_cancelled',
        message:
          'an active subscription already exists; cancel renewal and wait until the paid period ends before starting a new checkout',
      },
    });
  });

  it('retires an expired paused mandate before starting a replacement checkout', async () => {
    const oldMandate = {
      ...subscription(),
      providerPreapprovalId: 'expired-preapproval-id',
      providerStatus: 'paused',
      currentPeriodEndsAt: new Date('2020-10-01T00:00:00Z'),
    };
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(oldMandate)
      .mockResolvedValueOnce(subscription());
    let tombstoneInput:
      { create: { providerPreapprovalId: string } } | undefined;
    const tombstoneUpsert = jest.fn(
      (input: { create: { providerPreapprovalId: string } }) => {
        tombstoneInput = input;
        return Promise.resolve(undefined);
      },
    );
    let subscriptionInput:
      | {
          data: {
            providerPreapprovalId: null;
            providerStatus: string;
            plan: string;
            status: string;
          };
        }
      | undefined;
    const subscriptionUpdate = jest.fn(
      (input: NonNullable<typeof subscriptionInput>) => {
        subscriptionInput = input;
        return Promise.resolve(undefined);
      },
    );
    const tx = {
      $executeRaw: jest.fn(),
      subscription: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          providerPreapprovalId: 'expired-preapproval-id',
          providerStatus: 'paused',
          currentPeriodEndsAt: oldMandate.currentPeriodEndsAt,
        }),
        update: subscriptionUpdate,
      },
      subscriptionPreapprovalTombstone: { upsert: tombstoneUpsert },
    };
    const checkoutCreate = jest.fn().mockResolvedValue({
      id: 'new-checkout-id',
    });
    const checkoutUpdate = jest.fn().mockResolvedValue({
      targetPlan: 'basic',
      reference: 'new-reference',
      initPoint: 'https://checkout.test/new',
    });
    const prisma = {
      subscription: { findUnique },
      subscriptionCheckout: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: checkoutCreate,
        update: checkoutUpdate,
      },
      $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
        handler(tx as never),
      ),
    } as unknown as PrismaService;
    const cancelPreapproval = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn().mockResolvedValue({
      id: 'new-preapproval-id',
      status: 'pending',
      initPoint: 'https://checkout.test/new',
    });
    const service = new SubscriptionsService(prisma, config, {
      create,
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
      cancelPreapproval,
    });

    await expect(service.createCheckout('user-id', 'basic')).resolves.toEqual(
      expect.objectContaining({
        plan: 'basic',
        checkoutUrl: 'https://checkout.test/new',
      }),
    );

    expect(cancelPreapproval).toHaveBeenCalledWith('expired-preapproval-id');
    expect(tombstoneInput?.create.providerPreapprovalId).toBe(
      'expired-preapproval-id',
    );
    expect(subscriptionInput?.data).toMatchObject({
      providerPreapprovalId: null,
      providerStatus: 'cancelled',
      plan: 'free',
      status: 'canceled',
    });
    expect(checkoutCreate).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('replaces a cancelled pending preapproval after a canonical read without a webhook', async () => {
    const oldCheckout = {
      id: 'old-checkout-id',
      targetPlan: 'basic',
      reference: 'old-reference',
      state: 'pending',
      providerPreapprovalId: 'old-preapproval-id',
      initPoint: 'https://checkout.test/old',
    };
    const update = jest.fn().mockResolvedValue({
      targetPlan: 'basic',
      reference: 'replacement-reference',
      initPoint: 'https://checkout.test/replacement',
    });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const createReplacement = jest.fn().mockResolvedValue({
      id: 'replacement-checkout-id',
      reference: 'replacement-reference',
    });
    const tx = {
      $executeRaw: jest.fn(),
      subscriptionCheckout: { updateMany, create: createReplacement },
    };
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription()) },
      subscriptionCheckout: {
        findFirst: jest.fn().mockResolvedValue(oldCheckout),
        update,
      },
      $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
        handler(tx as never),
      ),
    } as unknown as PrismaService;
    const create = jest.fn().mockResolvedValue({
      id: 'replacement-preapproval-id',
      status: 'pending',
      initPoint: 'https://checkout.test/replacement',
    });
    const getPreapproval = jest.fn().mockResolvedValue({
      id: 'old-preapproval-id',
      status: 'cancelled',
      externalReference: 'old-reference',
      initPoint: null,
    });
    const service = new SubscriptionsService(prisma, config, {
      create,
      getAuthorizedPayment: jest.fn(),
      getPreapproval,
    });

    await expect(service.createCheckout('user-id', 'basic')).resolves.toEqual({
      plan: 'basic',
      reference: 'replacement-reference',
      checkoutUrl: 'https://checkout.test/replacement',
      reused: false,
    });
    expect(getPreapproval).toHaveBeenCalledWith('old-preapproval-id');
    const [expireInput] = updateMany.mock.calls[0] as [
      {
        where: {
          id: string;
          state: string;
          providerPreapprovalId: string;
        };
        data: { state: string; providerStatus: string };
      },
    ];
    expect(expireInput).toEqual({
      where: {
        id: 'old-checkout-id',
        subscriptionId: 'subscription-id',
        reference: 'old-reference',
        state: 'pending',
        providerPreapprovalId: 'old-preapproval-id',
      },
      data: { state: 'expired', providerStatus: 'cancelled' },
    });
    expect(createReplacement).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('reuses only a canonically pending preapproval with the same immutable reference', async () => {
    const checkout = {
      id: 'checkout-id',
      targetPlan: 'basic',
      reference: 'checkout-reference',
      state: 'pending',
      providerPreapprovalId: 'preapproval-id',
      initPoint: 'https://checkout.test/stale',
    };
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription()) },
      subscriptionCheckout: {
        findFirst: jest.fn().mockResolvedValue(checkout),
      },
    } as unknown as PrismaService;
    const create = jest.fn();
    const service = new SubscriptionsService(prisma, config, {
      create,
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn().mockResolvedValue({
        id: 'preapproval-id',
        status: 'pending',
        externalReference: 'checkout-reference',
        initPoint: 'https://checkout.test/canonical',
      }),
    });

    await expect(service.createCheckout('user-id', 'basic')).resolves.toEqual({
      plan: 'basic',
      reference: 'checkout-reference',
      checkoutUrl: 'https://checkout.test/canonical',
      reused: true,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ['provider error', () => Promise.reject(new Error('offline'))],
    [
      'reference mismatch',
      () =>
        Promise.resolve({
          id: 'preapproval-id',
          status: 'cancelled',
          externalReference: 'another-checkout',
          initPoint: null,
        }),
    ],
    [
      'active mandate',
      () =>
        Promise.resolve({
          id: 'preapproval-id',
          status: 'authorized',
          externalReference: 'checkout-reference',
          initPoint: null,
        }),
    ],
  ])(
    'does not reuse or replace a pending checkout after %s',
    async (_, reply) => {
      const prisma = {
        subscription: {
          findUnique: jest.fn().mockResolvedValue(subscription()),
        },
        subscriptionCheckout: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'checkout-id',
            targetPlan: 'basic',
            reference: 'checkout-reference',
            state: 'pending',
            providerPreapprovalId: 'preapproval-id',
            initPoint: 'https://checkout.test/stale',
          }),
        },
      } as unknown as PrismaService;
      const create = jest.fn();
      const service = new SubscriptionsService(prisma, config, {
        create,
        getAuthorizedPayment: jest.fn(),
        getPreapproval: jest.fn().mockImplementation(reply),
      });

      await expectRecovery(
        service.createCheckout('user-id', 'basic'),
        'checkout outcome is awaiting recovery',
      );
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('does not create a replacement when a concurrent retry already retired the cancelled checkout', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      subscriptionCheckout: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn(),
      },
    };
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription()) },
      subscriptionCheckout: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'checkout-id',
          targetPlan: 'basic',
          reference: 'checkout-reference',
          state: 'pending',
          providerPreapprovalId: 'preapproval-id',
          initPoint: 'https://checkout.test/stale',
        }),
      },
      $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
        handler(tx as never),
      ),
    } as unknown as PrismaService;
    const create = jest.fn();
    const service = new SubscriptionsService(prisma, config, {
      create,
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn().mockResolvedValue({
        id: 'preapproval-id',
        status: 'cancelled',
        externalReference: 'checkout-reference',
        initPoint: null,
      }),
    });

    await expect(
      service.createCheckout('user-id', 'basic'),
    ).rejects.toMatchObject({
      response: { code: 'checkout_in_progress' },
    });
    expect(tx.subscriptionCheckout.create).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it('persists a preapproval recovered by its immutable external reference', async () => {
    const update = jest.fn().mockResolvedValue({
      targetPlan: 'basic',
      reference: 'recovered-reference',
      initPoint: 'https://checkout.test/recovered',
    });
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription()) },
      subscriptionCheckout: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'checkout-id' }),
        update,
      },
    } as unknown as PrismaService;
    let requestedReference: string | undefined;
    const findPreapprovalByReference = jest.fn((reference: string) => {
      requestedReference = reference;
      return Promise.resolve({
        id: 'provider-id',
        status: 'pending',
        initPoint: 'https://checkout.test/recovered',
      });
    });
    const provider: MercadoPagoPreapprovalClient = {
      create: jest
        .fn()
        .mockRejectedValue(new AmbiguousPreapprovalCreationError()),
      findPreapprovalByReference,
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
    };
    const service = new SubscriptionsService(prisma, config, provider);
    await expect(
      service.createCheckout('user-id', 'basic'),
    ).resolves.toMatchObject({
      checkoutUrl: 'https://checkout.test/recovered',
      reused: true,
    });
    expect(requestedReference).toEqual(expect.any(String));
  });

  it('recovers a prior recovery-required reservation on a later checkout request', async () => {
    const update = jest.fn().mockResolvedValue({
      targetPlan: 'basic',
      reference: 'durable-reference',
      initPoint: 'https://checkout.test/recovered-later',
    });
    const create = jest.fn();
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription()) },
      subscriptionCheckout: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'existing-checkout-id',
          targetPlan: 'basic',
          reference: 'durable-reference',
          state: 'recovery_required',
          initPoint: null,
        }),
        create,
        update,
      },
    } as unknown as PrismaService;
    const providerCreate = jest.fn();
    const findPreapprovalByReference = jest.fn().mockResolvedValue({
      id: 'provider-id',
      status: 'pending',
      initPoint: 'https://checkout.test/recovered-later',
    });
    const provider: MercadoPagoPreapprovalClient = {
      create: providerCreate,
      findPreapprovalByReference,
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
    };
    const service = new SubscriptionsService(prisma, config, provider);

    await expect(service.createCheckout('user-id', 'basic')).resolves.toEqual({
      plan: 'basic',
      reference: 'durable-reference',
      checkoutUrl: 'https://checkout.test/recovered-later',
      reused: true,
    });
    expect(findPreapprovalByReference).toHaveBeenCalledWith(
      'durable-reference',
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'existing-checkout-id' } }),
    );
    expect(create).not.toHaveBeenCalled();
    expect(providerCreate).not.toHaveBeenCalled();
  });

  it('keeps a prior recovery-required reservation when later recovery finds no result', async () => {
    const create = jest.fn();
    const update = jest.fn();
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription()) },
      subscriptionCheckout: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'existing-checkout-id',
          targetPlan: 'basic',
          reference: 'durable-reference',
          state: 'recovery_required',
          initPoint: null,
        }),
        create,
        update,
      },
    } as unknown as PrismaService;
    const providerCreate = jest.fn();
    const findPreapprovalByReference = jest.fn().mockResolvedValue(null);
    const provider: MercadoPagoPreapprovalClient = {
      create: providerCreate,
      findPreapprovalByReference,
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
    };
    const service = new SubscriptionsService(prisma, config, provider);

    await expectRecovery(
      service.createCheckout('user-id', 'basic'),
      'checkout outcome is awaiting recovery',
    );
    expect(findPreapprovalByReference).toHaveBeenCalledWith(
      'durable-reference',
    );
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(providerCreate).not.toHaveBeenCalled();
  });

  it('preserves the opaque reservation when provider success cannot be persisted locally', async () => {
    let reservation: Record<string, unknown> | undefined;
    const create = jest.fn(({ data }: { data: Record<string, unknown> }) => {
      reservation = { id: 'checkout-id', ...data };
      return Promise.resolve({ id: 'checkout-id' });
    });
    const update = jest
      .fn()
      .mockRejectedValue(new Error('database unavailable'));
    const remove = jest.fn();
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription()) },
      subscriptionCheckout: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
        update,
        delete: remove,
      },
    } as unknown as PrismaService;
    const provider: MercadoPagoPreapprovalClient = {
      create: jest
        .fn<Promise<CreatedPreapproval>, [unknown]>()
        .mockResolvedValue({
          id: 'provider-id',
          status: 'pending',
          initPoint: 'https://checkout.test',
        }),
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
    };
    const service = new SubscriptionsService(prisma, config, provider);

    await expectRecovery(
      service.createCheckout('user-id', 'basic'),
      'checkout was created and is awaiting recovery',
    );
    expect(typeof reservation?.reference).toBe('string');
    expect(reservation?.state).toBe('recovery_required');
    expect(update).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it('preserves the reservation for an ambiguous provider failure', async () => {
    let createdState: string | undefined;
    const create = jest.fn(({ data }: { data: { state: string } }) => {
      createdState = data.state;
      return Promise.resolve({ id: 'checkout-id' });
    });
    const remove = jest.fn();
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription()) },
      subscriptionCheckout: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
        update: jest.fn(),
        delete: remove,
      },
    } as unknown as PrismaService;
    const provider: MercadoPagoPreapprovalClient = {
      create: jest.fn().mockRejectedValue(new Error('transport timeout')),
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
    };
    const service = new SubscriptionsService(prisma, config, provider);

    await expectRecovery(
      service.createCheckout('user-id', 'basic'),
      'checkout outcome is awaiting recovery',
    );
    expect(createdState).toBe('recovery_required');
    expect(remove).not.toHaveBeenCalled();
  });

  it('never deletes a reservation for a generic provider 4xx error', async () => {
    const remove = jest.fn();
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription()) },
      subscriptionCheckout: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'checkout-id' }),
        update: jest.fn(),
        delete: remove,
      },
    } as unknown as PrismaService;
    const provider: MercadoPagoPreapprovalClient = {
      create: jest
        .fn()
        .mockRejectedValue(new Error('Mercado Pago returned HTTP 409')),
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
    };
    const service = new SubscriptionsService(prisma, config, provider);

    await expectRecovery(
      service.createCheckout('user-id', 'basic'),
      'checkout outcome is awaiting recovery',
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes a reservation only for an explicit definitive provider rejection', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription()) },
      subscriptionCheckout: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'checkout-id' }),
        update: jest.fn(),
        delete: remove,
      },
    } as unknown as PrismaService;
    const provider: MercadoPagoPreapprovalClient = {
      create: jest
        .fn()
        .mockRejectedValue(new DefinitivePreapprovalRejectionError()),
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
    };
    const service = new SubscriptionsService(prisma, config, provider);

    await expect(
      service.createCheckout('user-id', 'basic'),
    ).rejects.toMatchObject({
      response: {
        code: 'billing_provider_rejected',
      },
    });
    expect(remove).toHaveBeenCalledWith({ where: { id: 'checkout-id' } });
  });

  it('requires recovery when durable deletion after a definitive rejection fails', async () => {
    const remove = jest
      .fn()
      .mockRejectedValue(new Error('database unavailable'));
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription()) },
      subscriptionCheckout: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'checkout-id' }),
        update: jest.fn(),
        delete: remove,
      },
    } as unknown as PrismaService;
    const provider: MercadoPagoPreapprovalClient = {
      create: jest
        .fn()
        .mockRejectedValue(new DefinitivePreapprovalRejectionError()),
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
    };
    const service = new SubscriptionsService(prisma, config, provider);

    await expectRecovery(
      service.createCheckout('user-id', 'basic'),
      'checkout outcome is awaiting recovery',
    );
    expect(remove).toHaveBeenCalledWith({ where: { id: 'checkout-id' } });
  });
});

describe('SubscriptionsService scheduled upgrades', () => {
  it('persists the upgrade intent before updating Mercado Pago and confirms it afterward', async () => {
    const current = {
      id: 'subscription-id',
      plan: 'basic' as const,
      status: 'active' as const,
      providerPreapprovalId: 'preapproval-id',
      providerStatus: 'authorized',
      currentPeriodEndsAt: new Date('2099-10-01T00:00:00.000Z'),
      pendingPlan: null as 'pro' | null,
      pendingPlanAmount: null as { toFixed(digits: number): string } | null,
      pendingPlanCurrency: null as string | null,
      pendingPlanConfirmedAt: null as Date | null,
    };
    const update = jest.fn(({ data }: { data: Record<string, unknown> }) => {
      Object.assign(current, data);
      if (typeof current.pendingPlanAmount === 'string') {
        const amount = current.pendingPlanAmount;
        current.pendingPlanAmount = { toFixed: () => amount };
      }
    });
    const tx = {
      $executeRaw: jest.fn(),
      subscription: {
        findUniqueOrThrow: jest.fn().mockImplementation(() => current),
        update,
      },
    };
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(current) },
      $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
        handler(tx as never),
      ),
    } as unknown as PrismaService;
    const updateRecurringAmount = jest.fn().mockImplementation(() => {
      expect(current.pendingPlan).toBe('pro');
      expect(current.pendingPlanConfirmedAt).toBeNull();
    });
    const service = new SubscriptionsService(prisma, config, {
      create: jest.fn(),
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
      updateRecurringAmount,
    });

    await expect(service.scheduleUpgrade('user-id', 'pro')).resolves.toEqual({
      targetPlan: 'pro',
      amount: '250.00',
      currency: 'ARS',
      effectiveAt: current.currentPeriodEndsAt,
    });

    expect(updateRecurringAmount).toHaveBeenCalledWith('preapproval-id', {
      amount: 250,
      currencyId: 'ARS',
    });
    expect(current.pendingPlan).toBe('pro');
    expect(current.pendingPlanConfirmedAt).toBeInstanceOf(Date);
  });

  it('does not call Mercado Pago again for a confirmed upgrade', async () => {
    const current = {
      id: 'subscription-id',
      plan: 'basic' as const,
      status: 'active' as const,
      providerPreapprovalId: 'preapproval-id',
      providerStatus: 'authorized',
      currentPeriodEndsAt: new Date('2099-10-01T00:00:00.000Z'),
      pendingPlan: 'pro' as const,
      pendingPlanAmount: { toFixed: () => '250.00' },
      pendingPlanCurrency: 'ARS',
      pendingPlanConfirmedAt: new Date('2099-09-01T00:00:00.000Z'),
    };
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(current) },
    } as unknown as PrismaService;
    const updateRecurringAmount = jest.fn();
    const service = new SubscriptionsService(prisma, config, {
      create: jest.fn(),
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
      updateRecurringAmount,
    });

    await expect(service.scheduleUpgrade('user-id', 'pro')).resolves.toEqual({
      targetPlan: 'pro',
      amount: '250.00',
      currency: 'ARS',
      effectiveAt: current.currentPeriodEndsAt,
    });
    expect(updateRecurringAmount).not.toHaveBeenCalled();
  });

  it('does not confirm an upgrade if renewal is paused during the provider update', async () => {
    const current = {
      id: 'subscription-id',
      plan: 'basic' as const,
      status: 'active' as const,
      providerPreapprovalId: 'preapproval-id',
      providerStatus: 'authorized',
      currentPeriodEndsAt: new Date('2099-10-01T00:00:00.000Z'),
      pendingPlan: null as 'pro' | null,
      pendingPlanAmount: null as { toFixed(digits: number): string } | null,
      pendingPlanCurrency: null as string | null,
      pendingPlanConfirmedAt: null as Date | null,
    };
    const tx = {
      $executeRaw: jest.fn(),
      subscription: {
        findUniqueOrThrow: jest.fn().mockImplementation(() => current),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          Object.assign(current, data);
          if (typeof current.pendingPlanAmount === 'string') {
            const amount = current.pendingPlanAmount;
            current.pendingPlanAmount = { toFixed: () => amount };
          }
        }),
      },
    };
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(current) },
      $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
        handler(tx as never),
      ),
    } as unknown as PrismaService;
    const updateRecurringAmount = jest.fn().mockImplementation(() => {
      current.providerStatus = 'paused';
    });
    const service = new SubscriptionsService(prisma, config, {
      create: jest.fn(),
      getAuthorizedPayment: jest.fn(),
      getPreapproval: jest.fn(),
      updateRecurringAmount,
    });

    await expect(service.scheduleUpgrade('user-id', 'pro')).rejects.toThrow();
    expect(current.pendingPlan).toBe('pro');
    expect(current.pendingPlanConfirmedAt).toBeNull();
  });
});

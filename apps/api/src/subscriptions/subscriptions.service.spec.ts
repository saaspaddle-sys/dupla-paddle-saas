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
  it('stores a cancelled mandate tombstone before allowing a replacement', async () => {
    let tombstoneData:
      { providerPreapprovalId: string; subscriptionId: string } | undefined;
    const createTombstone = jest.fn(
      (input: {
        data: { providerPreapprovalId: string; subscriptionId: string };
      }) => {
        tombstoneData = input.data;
        return Promise.resolve();
      },
    );
    let cancelledProviderId: string | null | undefined;
    const updateSubscription = jest.fn(
      (input: { data: { providerPreapprovalId: string | null } }) => {
        cancelledProviderId = input.data.providerPreapprovalId;
        return Promise.resolve();
      },
    );
    const cancelPreapproval = jest
      .fn<Promise<void>, [string]>()
      .mockResolvedValue(undefined);
    const transactionClient = {
      subscriptionPreapprovalTombstone: { create: createTombstone },
      subscription: { update: updateSubscription },
    };
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'subscription-id',
          providerPreapprovalId: 'preapproval-id',
        }),
      },
      $transaction: jest.fn(
        (handler: (client: typeof transactionClient) => Promise<unknown>) =>
          handler(transactionClient),
      ),
    } as unknown as PrismaService;
    const provider: MercadoPagoPreapprovalClient = {
      create: jest.fn(),
      getAuthorizedPayment: jest.fn(),
      cancelPreapproval,
    };
    const service = new SubscriptionsService(prisma, config, provider);

    await service.cancelMine('user-id');

    expect(cancelPreapproval).toHaveBeenCalledWith('preapproval-id');
    expect(tombstoneData).toMatchObject({
      providerPreapprovalId: 'preapproval-id',
      subscriptionId: 'subscription-id',
    });
    expect(cancelledProviderId).toBeNull();
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
    };
    const service = new SubscriptionsService(prisma, config, provider);

    await expectRecovery(
      service.createCheckout('user-id', 'basic'),
      'checkout outcome is awaiting recovery',
    );
    expect(remove).toHaveBeenCalledWith({ where: { id: 'checkout-id' } });
  });
});

import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  DefinitivePreapprovalRejectionError,
  type CreatedPreapproval,
  type MercadoPagoPreapprovalClient,
} from './mercado-pago-preapproval.client';
import { SubscriptionsService } from './subscriptions.service';

const config = {
  get: <T>(key: string): T | undefined => {
    const values: Record<string, string> = {
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

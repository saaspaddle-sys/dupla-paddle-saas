import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { MercadoPagoPreapprovalClient } from './mercado-pago-preapproval.client';
import { SubscriptionsService } from './subscriptions.service';

const config = {
  get: (key: string) =>
    ({
      MERCADO_PAGO_BASIC_AMOUNT: '100',
      MERCADO_PAGO_CURRENCY: 'ARS',
      MERCADO_PAGO_BACK_URL: 'https://app.test/return',
    })[key],
} as ConfigService;

function setup(updateRecurringAmount = jest.fn().mockResolvedValue(undefined)) {
  const periodEndsAt = new Date('2099-10-01T00:00:00.000Z');
  const current = {
    id: 'subscription-id',
    plan: 'pro' as 'pro' | 'basic',
    status: 'active',
    providerPreapprovalId: 'preapproval-id',
    providerStatus: 'authorized',
    currentPeriodEndsAt: periodEndsAt,
    pendingPlan: null as 'basic' | null,
    pendingPlanAmount: null as { toFixed(digits: number): string } | null,
    pendingPlanCurrency: null as string | null,
    pendingPlanConfirmedAt: null as Date | null,
    pendingPlanEffectiveAt: null as Date | null,
    pendingPlanPaidAt: null as Date | null,
  };
  const update = jest.fn(({ data }: { data: Record<string, unknown> }) => {
    Object.assign(current, data);
    if (typeof current.pendingPlanAmount === 'string') {
      const amount = current.pendingPlanAmount;
      current.pendingPlanAmount = { toFixed: () => amount };
    }
    return current;
  });
  const tx = {
    $executeRaw: jest.fn(),
    subscription: {
      findUniqueOrThrow: jest.fn().mockImplementation(() => current),
      update,
    },
    subscriptionUpgrade: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const prisma = {
    subscription: {
      findUnique: jest.fn().mockResolvedValue({ id: current.id }),
    },
    $transaction: jest.fn((handler: (client: never) => Promise<unknown>) =>
      handler(tx as never),
    ),
  } as unknown as PrismaService;
  const provider = {
    updateRecurringAmount,
  } as unknown as MercadoPagoPreapprovalClient;
  const service = new SubscriptionsService(prisma, config, provider);
  return { current, update, tx, service, updateRecurringAmount, periodEndsAt };
}

describe('SubscriptionsService scheduled downgrade', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2099-09-16T00:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('keeps Pro active and confirms the next Basic recurring amount', async () => {
    const h = setup();

    await expect(h.service.scheduleDowngrade('user-id')).resolves.toEqual({
      targetPlan: 'basic',
      amount: '100.00',
      currency: 'ARS',
      effectiveAt: h.periodEndsAt,
    });
    expect(h.current.plan).toBe('pro');
    expect(h.current.pendingPlan).toBe('basic');
    expect(h.current.pendingPlanConfirmedAt).toBeInstanceOf(Date);
    expect(h.current.pendingPlanEffectiveAt).toEqual(h.periodEndsAt);
    expect(h.updateRecurringAmount).toHaveBeenCalledWith('preapproval-id', {
      amount: 100,
      currencyId: 'ARS',
    });
  });

  it('leaves a retryable intent without claiming confirmation on provider failure', async () => {
    const h = setup(jest.fn().mockRejectedValue(new Error('provider offline')));

    await expect(h.service.scheduleDowngrade('user-id')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(h.current.pendingPlan).toBe('basic');
    expect(h.current.pendingPlanConfirmedAt).toBeNull();
    expect(h.current.plan).toBe('pro');
  });

  it('blocks a downgrade while another plan change is open', async () => {
    const h = setup();
    h.tx.subscriptionUpgrade.findFirst.mockResolvedValueOnce({
      id: 'upgrade-id',
    });

    await expect(h.service.scheduleDowngrade('user-id')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(h.update).not.toHaveBeenCalled();
    expect(h.updateRecurringAmount).not.toHaveBeenCalled();
  });
});

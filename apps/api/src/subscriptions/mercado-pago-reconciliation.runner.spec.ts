import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoReconciliationRunner } from './mercado-pago-reconciliation.runner';
import { MercadoPagoWebhookService } from './mercado-pago-webhook.service';

type UpdateLease = (input: {
  where: {
    name?: string;
    ownerToken?: string;
    lockedUntil?: { gt: Date };
  };
  data?: { lockedUntil?: Date };
}) => Promise<{ count: number }>;

describe('MercadoPagoReconciliationRunner lease', () => {
  afterEach(() => jest.useRealTimers());

  it('heartbeats while a slow provider reconciliation is still processing', async () => {
    jest.useFakeTimers();
    let finish: (() => void) | undefined;
    const reconcilePendingAuthorizedPayments = jest.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    let leaseUpdate: Parameters<UpdateLease>[0] | undefined;
    const updateMany = jest.fn((input: Parameters<UpdateLease>[0]) => {
      leaseUpdate = input;
      return Promise.resolve({ count: 1 });
    });
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ name: 'lock' }]),
      billingJobLock: { updateMany },
    } as unknown as PrismaService;
    const runner = new MercadoPagoReconciliationRunner(
      { get: jest.fn() } as unknown as ConfigService,
      prisma,
      {
        reconcilePendingAuthorizedPayments,
        expirePastDueEntitlements: jest.fn().mockResolvedValue(0),
      } as unknown as MercadoPagoWebhookService,
    );

    const running = runner.runOnce();
    await jest.advanceTimersByTimeAsync(20_000);
    expect(leaseUpdate?.where.ownerToken).toEqual(expect.any(String));
    finish?.();
    await running;
  });

  it('renews only its still-live, token-owned distributed lease', async () => {
    let leaseUpdate: Parameters<UpdateLease>[0] | undefined;
    const updateMany = jest.fn((input: Parameters<UpdateLease>[0]) => {
      leaseUpdate = input;
      return Promise.resolve({ count: 1 });
    });
    const prisma = {
      billingJobLock: { updateMany },
    } as unknown as PrismaService;
    const runner = new MercadoPagoReconciliationRunner(
      { get: jest.fn() } as unknown as ConfigService,
      prisma,
      {} as MercadoPagoWebhookService,
    );

    await (runner as unknown as { renew(token: string): Promise<void> }).renew(
      'owner-token',
    );

    expect(leaseUpdate?.where.name).toBe(
      'mercado_pago_subscription_reconciliation',
    );
    expect(leaseUpdate?.where.ownerToken).toBe('owner-token');
    expect(leaseUpdate?.where.lockedUntil?.gt).toBeInstanceOf(Date);
    expect(leaseUpdate?.data?.lockedUntil).toBeInstanceOf(Date);
  });

  it('waits for active reconciliation and lease release during application shutdown', async () => {
    let finishReconciliation: (() => void) | undefined;
    const reconcilePendingAuthorizedPayments = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishReconciliation = resolve;
        }),
    );
    let finishRelease: (() => void) | undefined;
    const updateMany = jest.fn(() => {
      return new Promise<{ count: number }>((resolve) => {
        finishRelease = () => resolve({ count: 1 });
      });
    });
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ name: 'lock' }]),
      billingJobLock: { updateMany },
    } as unknown as PrismaService;
    const runner = new MercadoPagoReconciliationRunner(
      {
        get: jest.fn((key: string) =>
          key === 'MERCADO_PAGO_ACCESS_TOKEN' ? 'test-token' : undefined,
        ),
      } as unknown as ConfigService,
      prisma,
      {
        reconcilePendingAuthorizedPayments,
        expirePastDueEntitlements: jest.fn().mockResolvedValue(0),
      } as unknown as MercadoPagoWebhookService,
    );
    runner.onModuleInit();
    await Promise.resolve();

    let shutdownFinished = false;
    const shutdown = runner.onApplicationShutdown().then(() => {
      shutdownFinished = true;
    });
    await Promise.resolve();
    expect(shutdownFinished).toBe(false);

    finishReconciliation?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(shutdownFinished).toBe(false);

    finishRelease?.();
    await shutdown;
    expect(shutdownFinished).toBe(true);
    await expect(runner.runOnce()).resolves.toBeUndefined();
    expect(reconcilePendingAuthorizedPayments).toHaveBeenCalledTimes(1);
  });
});

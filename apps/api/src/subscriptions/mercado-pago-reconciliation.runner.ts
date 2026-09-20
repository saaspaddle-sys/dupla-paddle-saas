import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoWebhookService } from './mercado-pago-webhook.service';

const JOB_NAME = 'mercado_pago_subscription_reconciliation';
const LEASE_SECONDS = 55;
const HEARTBEAT_MS = 20_000;

/**
 * The current application has no queue runtime. This bounded runner is the
 * durable minimum: its lease lives in Postgres, so horizontally scaled API
 * instances do not process the same pending events concurrently.
 */
@Injectable()
export class MercadoPagoReconciliationRunner
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(MercadoPagoReconciliationRunner.name);
  private timer?: NodeJS.Timeout;
  private activeRun?: Promise<void>;
  private shuttingDown = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly webhooks: MercadoPagoWebhookService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<string>('MERCADO_PAGO_ACCESS_TOKEN')) {
      this.logger.warn(
        'Mercado Pago reconciliation is disabled: billing is not configured',
      );
      return;
    }
    const interval = Number(
      this.config.get('MERCADO_PAGO_RECONCILIATION_INTERVAL_MS') ?? 60_000,
    );
    if (!Number.isInteger(interval) || interval < 10_000) {
      this.logger.error(
        'Mercado Pago reconciliation is disabled: invalid interval',
      );
      return;
    }
    this.timer = setInterval(() => void this.runOnce(), interval);
    this.timer.unref();
    void this.runOnce();
  }

  async onApplicationShutdown(): Promise<void> {
    this.shuttingDown = true;
    if (this.timer) clearInterval(this.timer);
    await this.activeRun;
  }

  runOnce(): Promise<void> {
    if (this.shuttingDown) return Promise.resolve();
    if (this.activeRun) return this.activeRun;

    const activeRun = this.executeRun().finally(() => {
      if (this.activeRun === activeRun) this.activeRun = undefined;
    });
    this.activeRun = activeRun;
    return activeRun;
  }

  private async executeRun(): Promise<void> {
    const token = randomUUID();
    try {
      const acquired = await this.acquire(token);
      if (!acquired) return;
      const heartbeat = setInterval(() => {
        void this.renew(token).catch((error: unknown) => {
          this.logger.error(
            'Mercado Pago reconciliation lease heartbeat failed',
            error instanceof Error ? error.stack : undefined,
          );
        });
      }, HEARTBEAT_MS);
      heartbeat.unref();
      try {
        const reconciled =
          await this.webhooks.reconcilePendingAuthorizedPayments();
        const expired = await this.webhooks.expirePastDueEntitlements();
        if (reconciled || expired)
          this.logger.log(
            `Mercado Pago reconciliation: ${reconciled} events, ${expired} expirations`,
          );
      } finally {
        clearInterval(heartbeat);
        await this.release(token);
      }
    } catch (error) {
      this.logger.error(
        'Mercado Pago reconciliation failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async acquire(token: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ name: string }[]>`
      INSERT INTO billing_job_locks (name, owner_token, locked_until, updated_at)
      VALUES (${JOB_NAME}, ${token}, NOW() + INTERVAL '55 seconds', NOW())
      ON CONFLICT (name) DO UPDATE
        SET owner_token = EXCLUDED.owner_token,
            locked_until = EXCLUDED.locked_until,
            updated_at = NOW()
        WHERE billing_job_locks.locked_until <= NOW()
      RETURNING name`;
    return rows.length === 1;
  }

  private async renew(token: string): Promise<void> {
    // The owner predicate prevents a stale worker from extending a lease that
    // a healthy instance already acquired after expiration.
    await this.prisma.billingJobLock.updateMany({
      where: {
        name: JOB_NAME,
        ownerToken: token,
        lockedUntil: { gt: new Date() },
      },
      data: {
        lockedUntil: new Date(Date.now() + LEASE_SECONDS * 1_000),
      },
    });
  }

  private release(token: string): Promise<unknown> {
    return this.prisma.billingJobLock.updateMany({
      where: { name: JOB_NAME, ownerToken: token },
      data: { lockedUntil: new Date() },
    });
  }
}

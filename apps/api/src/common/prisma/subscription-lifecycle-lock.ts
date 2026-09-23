import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Serializes provider lifecycle calls for one subscription across API
 * instances. The lock is transaction-scoped: it disappears if the request
 * crashes, unlike a persisted intermediate status.
 */
export function withSubscriptionLifecycleLock<T>(
  prisma: Pick<PrismaService, '$transaction'>,
  subscriptionId: string,
  handler: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${subscriptionId}))
    `;
    return handler(tx);
  });
}

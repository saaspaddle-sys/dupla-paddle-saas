import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  runSerializable,
  SERIALIZABLE_MAX_ATTEMPTS,
  SerializableTransactionHost,
} from './serializable';

type PrismaMock = { $transaction: jest.Mock };

/** El único código que `runSerializable` reintenta (SQLSTATE 40001). */
function serializationFailure(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'could not serialize access due to concurrent update',
    { code: 'P2034', clientVersion: 'test' },
  );
}

describe('runSerializable', () => {
  let prisma: PrismaMock;
  const handler = jest.fn();

  beforeEach(() => {
    prisma = { $transaction: jest.fn() };
    handler.mockReset();
  });

  it('returns the handler result on the first successful attempt', async () => {
    prisma.$transaction.mockResolvedValue('ok');

    await expect(
      runSerializable(
        prisma as unknown as SerializableTransactionHost,
        handler,
      ),
    ).resolves.toBe('ok');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('retries once and returns the result of the second attempt after a P2034', async () => {
    prisma.$transaction
      .mockRejectedValueOnce(serializationFailure())
      .mockResolvedValueOnce('ok-on-second-try');

    await expect(
      runSerializable(
        prisma as unknown as SerializableTransactionHost,
        handler,
      ),
    ).resolves.toBe('ok-on-second-try');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('retries twice and returns the result of the third and last attempt', async () => {
    prisma.$transaction
      .mockRejectedValueOnce(serializationFailure())
      .mockRejectedValueOnce(serializationFailure())
      .mockResolvedValueOnce('ok-on-third-try');

    await expect(
      runSerializable(
        prisma as unknown as SerializableTransactionHost,
        handler,
      ),
    ).resolves.toBe('ok-on-third-try');
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('propagates the last error once every attempt is exhausted', async () => {
    const lastError = serializationFailure();
    // Las tres veces fallan con 40001: agotado `SERIALIZABLE_MAX_ATTEMPTS`,
    // la última pasada corre fuera del `try/catch` y su rechazo sube tal
    // cual — no hay una cuarta pasada ni un error envuelto.
    prisma.$transaction.mockRejectedValue(lastError);

    await expect(
      runSerializable(
        prisma as unknown as SerializableTransactionHost,
        handler,
      ),
    ).rejects.toBe(lastError);
    expect(prisma.$transaction).toHaveBeenCalledTimes(
      SERIALIZABLE_MAX_ATTEMPTS,
    );
  });

  it('lets a non-P2034 error bubble up on the first attempt, without retrying', async () => {
    // Un `ConflictException` de negocio (cuota, duplicado) no es una
    // carrera: reintentarlo gastaría dos viajes más a la base para devolver
    // exactamente el mismo error.
    const businessError = new ConflictException({ code: 'some_conflict' });
    prisma.$transaction.mockRejectedValue(businessError);

    await expect(
      runSerializable(
        prisma as unknown as SerializableTransactionHost,
        handler,
      ),
    ).rejects.toBe(businessError);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('runs the transaction with the Serializable isolation level', async () => {
    prisma.$transaction.mockResolvedValue('ok');

    await runSerializable(
      prisma as unknown as SerializableTransactionHost,
      handler,
    );

    expect(prisma.$transaction).toHaveBeenCalledWith(handler, {
      isolationLevel: 'Serializable',
    });
  });
});

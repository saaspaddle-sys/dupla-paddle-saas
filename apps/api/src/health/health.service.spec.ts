import { Logger } from '@nestjs/common';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  $queryRaw: jest.Mock;
};

describe('HealthService', () => {
  let prisma: PrismaMock;
  let service: HealthService;
  // Se guarda el spy en vez de aseverar sobre `Logger.prototype.error`:
  // referenciar el método suelto dispara `@typescript-eslint/unbound-method`,
  // que en este repo es error de CI.
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    service = new HealthService(prisma as unknown as PrismaService);
    // El camino de fallo loguea el stack a propósito; silenciarlo acá
    // evita que la salida de Jest parezca un test roto cuando pasa.
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports the database as reachable when the query succeeds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.isDatabaseReachable()).resolves.toBe(true);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('reports the database as unreachable when the query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.isDatabaseReachable()).resolves.toBe(false);
  });

  it('logs the underlying error instead of swallowing it', async () => {
    const cause = new Error('ECONNREFUSED 127.0.0.1:5432');
    prisma.$queryRaw.mockRejectedValue(cause);

    await service.isDatabaseReachable();

    expect(errorLog).toHaveBeenCalledWith(cause.stack);
  });
});

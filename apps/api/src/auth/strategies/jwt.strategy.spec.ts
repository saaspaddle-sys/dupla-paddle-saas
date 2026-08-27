import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

type PrismaMock = {
  user: { findUnique: jest.Mock };
};

function createConfig(): ConfigService {
  return {
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;
}

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    strategy = new JwtStrategy(
      createConfig(),
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('resolves the authenticated user, including its player and club, from the DB', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'juan@example.com',
      status: 'active',
      player: {
        id: 'player-1',
        firstName: 'Juan',
        lastName: 'Pérez',
        category: null,
        gender: null,
      },
      clubs: [
        {
          id: 'club-1',
          name: 'Club Ñandú',
          slug: 'club-nandu',
          status: 'active',
        },
      ],
    });

    const result = await strategy.validate({ sub: 'user-1' });

    expect(result).toEqual({
      id: 'user-1',
      email: 'juan@example.com',
      player: {
        id: 'player-1',
        firstName: 'Juan',
        lastName: 'Pérez',
        category: null,
        gender: null,
      },
      club: {
        id: 'club-1',
        name: 'Club Ñandú',
        slug: 'club-nandu',
        status: 'active',
      },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }) as unknown,
    );
  });

  it('returns player: null when the user has no linked Player', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'juan@example.com',
      status: 'active',
      player: null,
      clubs: [],
    });

    const result = await strategy.validate({ sub: 'user-1' });

    expect(result.player).toBeNull();
  });

  it('returns club: null when the account owns no club', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'juan@example.com',
      status: 'active',
      player: null,
      clubs: [],
    });

    const result = await strategy.validate({ sub: 'user-1' });

    expect(result.club).toBeNull();
  });

  // El `orderBy` no es decorativo: la relación es 1:N, así que sin orden
  // explícito el tenant de un request dependería del orden de filas que
  // devuelva Postgres. Este test es lo que impide que alguien lo saque
  // "porque no hace nada".
  it('asks for a single club, deterministically ordered by creation date', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'juan@example.com',
      status: 'active',
      player: null,
      clubs: [],
    });

    await strategy.validate({ sub: 'user-1' });

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          clubs: expect.objectContaining({
            take: 1,
            orderBy: { createdAt: 'asc' },
          }) as unknown,
        }) as unknown,
      }) as unknown,
    );
  });

  it('rejects with 401 unauthenticated when the user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'deleted-user' }),
    ).rejects.toMatchObject({
      status: 401,
      response: expect.objectContaining({ code: 'unauthenticated' }) as unknown,
    });
  });

  it('rejects with 401 unauthenticated when the user is suspended', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'juan@example.com',
      status: 'suspended',
      player: null,
    });

    await expect(strategy.validate({ sub: 'user-1' })).rejects.toMatchObject({
      status: 401,
      response: expect.objectContaining({ code: 'unauthenticated' }) as unknown,
    });
  });
});

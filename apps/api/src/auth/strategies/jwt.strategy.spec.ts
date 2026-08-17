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

  it('resolves the authenticated user, including its player, from the DB', async () => {
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
    });

    const result = await strategy.validate({ sub: 'user-1' });

    expect(result.player).toBeNull();
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

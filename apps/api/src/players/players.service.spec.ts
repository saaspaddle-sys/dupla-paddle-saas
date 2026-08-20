import bcrypt from 'bcryptjs';
import { RegisterPlayerDto } from './dto/register-player.dto';
import { PlayersService } from './players.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

type PrismaMock = {
  $transaction: jest.Mock;
  user: { findUnique: jest.Mock; create: jest.Mock };
  player: {
    findUnique: jest.Mock;
    create: jest.Mock;
    updateManyAndReturn: jest.Mock;
  };
};

function createDto(
  overrides: Partial<RegisterPlayerDto> = {},
): RegisterPlayerDto {
  const dto = new RegisterPlayerDto();
  Object.assign(dto, {
    email: 'juan@example.com',
    password: 'password123',
    dni: '35123456',
    firstName: 'Juan',
    lastName: 'Pérez',
    ...overrides,
  });
  return dto;
}

/**
 * `.mock.calls` de un `jest.Mock` sin generics tipa cada entrada como
 * `any`, y el lint marca cada indexado sobre eso como acceso inseguro. Se
 * pasa por `unknown` (que sí se puede indexar sin disparar la regla) antes
 * de castear al shape esperado.
 */
function lastArgument<T>(mockFn: jest.Mock): T {
  const calls = mockFn.mock.calls as unknown[][];
  return calls[calls.length - 1][0] as T;
}

describe('PlayersService', () => {
  let service: PlayersService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(prisma),
      ),
      user: { findUnique: jest.fn(), create: jest.fn() },
      player: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateManyAndReturn: jest.fn(),
      },
    };
    service = new PlayersService(prisma as unknown as PrismaService);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed:password123');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when the dni has no previous profile', () => {
    it('creates a new User and a new Player, linked to each other', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'juan@example.com',
      });
      prisma.player.create.mockResolvedValue({
        id: 'player-1',
        firstName: 'Juan',
        lastName: 'Pérez',
        category: null,
        gender: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await service.register(createDto());

      expect(result.outcome).toBe('created');
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'juan@example.com',
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: 'juan@example.com', passwordHash: 'hashed:password123' },
      });
      expect(prisma.player.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          dni: '35123456',
          firstName: 'Juan',
          lastName: 'Pérez',
        }) as unknown,
      });
    });

    it('persists the optional profile fields, normalized', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'juan@example.com',
      });
      prisma.player.create.mockResolvedValue({
        id: 'player-1',
        firstName: 'Juan',
        lastName: 'Pérez',
        category: null,
        gender: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      await service.register(
        createDto({
          dominantHand: 'left',
          country: 'ar',
          province: '  Buenos Aires  ',
          phone: '+54 9 2284 12-3456',
          emergencyPhone: '+54 (2284) 65-4321',
        }),
      );

      const call = lastArgument<{ data: Record<string, unknown> }>(
        prisma.player.create,
      );
      expect(call.data).toMatchObject({
        dominantHand: 'left',
        country: 'AR',
        province: 'Buenos Aires',
        phone: '+5492284123456',
        emergencyPhone: '+542284654321',
      });
    });

    it('stores the optional profile fields as null when they are absent', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'juan@example.com',
      });
      prisma.player.create.mockResolvedValue({
        id: 'player-1',
        firstName: 'Juan',
        lastName: 'Pérez',
        category: null,
        gender: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      await service.register(createDto());

      const call = lastArgument<{ data: Record<string, unknown> }>(
        prisma.player.create,
      );
      expect(call.data).toMatchObject({
        dominantHand: null,
        country: null,
        province: null,
        phone: null,
        emergencyPhone: null,
      });
    });
  });

  describe('when the dni already has an ownerless profile (claim)', () => {
    it('links the existing profile instead of creating a new one, keeping its id', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue({
        id: 'orphan-player',
        userId: null,
        dni: '35123456',
        firstName: 'Juan',
        lastName: 'Pérez',
        email: null,
        category: null,
        gender: null,
        birthDate: null,
      });
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'juan@example.com',
      });
      prisma.player.updateManyAndReturn.mockResolvedValue([
        {
          id: 'orphan-player',
          firstName: 'Juan',
          lastName: 'Pérez',
          category: null,
          gender: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);

      const result = await service.register(createDto());

      expect(result.outcome).toBe('claimed');
      expect(result.player.id).toBe('orphan-player');
      expect(prisma.player.create).not.toHaveBeenCalled();
      expect(prisma.player.updateManyAndReturn).toHaveBeenCalledWith({
        where: { id: 'orphan-player', userId: null },
        data: expect.objectContaining({ userId: 'user-1' }) as unknown,
      });
    });

    it('does not overwrite firstName/lastName nor a pre-existing email different from the one in the DTO', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue({
        id: 'orphan-player',
        userId: null,
        dni: '35123456',
        firstName: 'Juan Ignacio',
        lastName: 'Pérez',
        email: 'contacto-del-club@example.com',
        category: null,
        gender: null,
        birthDate: null,
      });
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'juan@example.com',
      });
      prisma.player.updateManyAndReturn.mockResolvedValue([
        {
          id: 'orphan-player',
          firstName: 'Juan Ignacio',
          lastName: 'Pérez',
          category: null,
          gender: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);

      await service.register(createDto());

      const call = lastArgument<{ data: { email?: string } }>(
        prisma.player.updateManyAndReturn,
      );
      expect(call.data.email).toBe('contacto-del-club@example.com');
      // firstName/lastName ni siquiera se mandan en el update: el modelo no
      // tiene ese campo en el `data`, así que no hay forma de que lo pisen.
      expect(call.data).not.toHaveProperty('firstName');
      expect(call.data).not.toHaveProperty('lastName');
    });

    it('fills empty fields of the orphan profile with the ones from the DTO', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue({
        id: 'orphan-player',
        userId: null,
        dni: '35123456',
        firstName: 'Juan',
        lastName: 'Pérez',
        email: null,
        category: null,
        gender: null,
        birthDate: null,
        dominantHand: null,
        country: null,
        province: null,
        phone: null,
        emergencyPhone: null,
      });
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'juan@example.com',
      });
      prisma.player.updateManyAndReturn.mockResolvedValue([
        {
          id: 'orphan-player',
          firstName: 'Juan',
          lastName: 'Pérez',
          category: 'caballeros cuarta',
          gender: 'male',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);

      await service.register(
        createDto({
          category: 'caballeros cuarta',
          gender: 'male',
          dominantHand: 'left',
          country: 'AR',
          province: 'Buenos Aires',
          phone: '+5492284123456',
          emergencyPhone: '+542284654321',
        }),
      );

      const call = lastArgument<{ data: Record<string, unknown> }>(
        prisma.player.updateManyAndReturn,
      );
      expect(call.data).toMatchObject({
        email: 'juan@example.com',
        category: 'caballeros cuarta',
        gender: 'male',
        dominantHand: 'left',
        country: 'AR',
        province: 'Buenos Aires',
        phone: '+5492284123456',
        emergencyPhone: '+542284654321',
      });
    });

    it('does not overwrite the profile data the club had already loaded', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue({
        id: 'orphan-player',
        userId: null,
        dni: '35123456',
        firstName: 'Juan',
        lastName: 'Pérez',
        email: null,
        category: null,
        gender: null,
        birthDate: null,
        dominantHand: 'right',
        country: 'UY',
        province: 'Montevideo',
        phone: '+59899123456',
        emergencyPhone: '+59899654321',
      });
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'juan@example.com',
      });
      prisma.player.updateManyAndReturn.mockResolvedValue([
        {
          id: 'orphan-player',
          firstName: 'Juan',
          lastName: 'Pérez',
          category: null,
          gender: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);

      await service.register(
        createDto({
          dominantHand: 'left',
          country: 'AR',
          province: 'Buenos Aires',
          phone: '+5492284123456',
          emergencyPhone: '+542284654321',
        }),
      );

      const call = lastArgument<{ data: Record<string, unknown> }>(
        prisma.player.updateManyAndReturn,
      );
      expect(call.data).toMatchObject({
        dominantHand: 'right',
        country: 'UY',
        province: 'Montevideo',
        phone: '+59899123456',
        emergencyPhone: '+59899654321',
      });
    });

    it('returns 409 dni_has_account when it loses the race against a concurrent claim', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue({
        id: 'orphan-player',
        userId: null,
        dni: '35123456',
        firstName: 'Juan',
        lastName: 'Pérez',
        email: null,
        category: null,
        gender: null,
        birthDate: null,
      });
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'juan@example.com',
      });
      // El guard `userId: null` del WHERE no afectó ninguna fila: otro
      // claim ya lo tomó entre el findUnique y este update.
      prisma.player.updateManyAndReturn.mockResolvedValue([]);

      await expect(service.register(createDto())).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'dni_has_account',
        }) as unknown,
      });
    });
  });

  it('rejects with 409 email_registered when a User with that email already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(service.register(createDto())).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: 'email_registered',
      }) as unknown,
    });
    expect(prisma.player.findUnique).not.toHaveBeenCalled();
  });

  it('rejects with 409 dni_has_account when the Player already has an owner, without revealing who', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.player.findUnique.mockResolvedValue({
      id: 'player-1',
      userId: 'another-user',
    });

    const promise = service.register(createDto());

    await expect(promise).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'dni_has_account' }) as unknown,
    });
    await expect(
      promise.catch(
        (e: { response: { message: string } }) => e.response.message,
      ),
    ).resolves.not.toMatch(/another-user/);
  });

  it('normalizes the dni (strips dots, spaces and dashes) before looking it up or creating it', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.player.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'juan@example.com',
    });
    prisma.player.create.mockResolvedValue({
      id: 'player-1',
      firstName: 'Juan',
      lastName: 'Pérez',
      category: null,
      gender: null,
      createdAt: new Date(),
    });

    await service.register(createDto({ dni: '35.123-456 ' }));

    expect(prisma.player.findUnique).toHaveBeenCalledWith({
      where: { dni: '35123456' },
    });
  });

  it('normalizes the email (trim + lowercase) before looking it up or creating it', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.player.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'juan@example.com',
    });
    prisma.player.create.mockResolvedValue({
      id: 'player-1',
      firstName: 'Juan',
      lastName: 'Pérez',
      category: null,
      gender: null,
      createdAt: new Date(),
    });

    await service.register(createDto({ email: '  JUAN@Example.COM  ' }));

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'juan@example.com' },
    });
  });

  describe('race fallback: P2002 from the unique index', () => {
    function createP2002Error(
      target: string,
    ): Prisma.PrismaClientKnownRequestError {
      return new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.9.1',
          meta: { target },
        },
      );
    }

    it('maps a P2002 on the dni constraint to 409 dni_has_account', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(createP2002Error('players_dni_key'));

      await expect(service.register(createDto())).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'dni_has_account',
        }) as unknown,
      });
    });

    it('maps a P2002 on the email constraint to 409 email_registered', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(createP2002Error('users_email_key'));

      await expect(service.register(createDto())).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'email_registered',
        }) as unknown,
      });
    });

    it('lets a P2002 on an unknown constraint bubble up, without disguising it as a 409', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue(null);
      const error = createP2002Error('something_unexpected_key');
      prisma.user.create.mockRejectedValue(error);

      await expect(service.register(createDto())).rejects.toBe(error);
    });
  });

  it('hashes the password before opening the transaction', async () => {
    const order: string[] = [];
    (bcrypt.hash as jest.Mock).mockImplementation(() => {
      order.push('hash');
      return Promise.resolve('hashed:password123');
    });
    prisma.$transaction.mockImplementation(
      (callback: (tx: unknown) => unknown) => {
        order.push('transaction');
        return callback(prisma);
      },
    );
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.player.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'juan@example.com',
    });
    prisma.player.create.mockResolvedValue({
      id: 'player-1',
      firstName: 'Juan',
      lastName: 'Pérez',
      category: null,
      gender: null,
      createdAt: new Date(),
    });

    await service.register(createDto());

    expect(order).toEqual(['hash', 'transaction']);
  });
});

import bcrypt from 'bcryptjs';
import { CreateOrganizerPlayerDto } from './dto/create-organizer-player.dto';
import { ListOrganizerPlayersDto } from './dto/list-organizer-players.dto';
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
    findMany: jest.Mock;
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
        findMany: jest.fn(),
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

  describe('when the dni has an ownerless profile', () => {
    it('requires a later email-verification claim instead of auto-linking by DNI', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue({
        id: 'ownerless-player',
        userId: null,
        email: 'stored@example.com',
      });

      await expect(service.register(createDto())).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'profile_claim_verification_required',
        }) as unknown,
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.player.updateManyAndReturn).not.toHaveBeenCalled();
    });
  });

  describe('organizer player directory', () => {
    it('creates an ownerless global profile without credentials', async () => {
      prisma.player.create.mockResolvedValue({
        id: 'player-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        category: null,
        gender: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      const dto = Object.assign(new CreateOrganizerPlayerDto(), {
        email: ' ADA@Example.COM ',
        dni: '35.123-456',
        firstName: ' Ada ',
        lastName: ' Lovelace ',
      });

      const result = await service.createForOrganizer(dto);

      expect(result).toEqual({
        id: 'player-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        category: null,
        gender: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(prisma.player.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'ada@example.com',
          dni: '35123456',
          firstName: 'Ada',
          lastName: 'Lovelace',
        }) as unknown,
      });
      expect(
        lastArgument<{ data: Record<string, unknown> }>(prisma.player.create)
          .data,
      ).not.toHaveProperty('userId');
    });

    it('paginates a name lookup and never maps contact fields to the result', async () => {
      prisma.player.findMany.mockResolvedValue([
        {
          id: '019aaa00-0000-7000-8000-000000000002',
          firstName: 'Ada',
          lastName: 'Lovelace',
          category: 'Open',
          gender: 'female',
          email: 'ada@example.com',
          dni: '35123456',
          phone: '+5492284123456',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        },
        {
          id: '019aaa00-0000-7000-8000-000000000001',
          firstName: 'Ada',
          lastName: 'Byron',
          category: null,
          gender: null,
          email: 'byron@example.com',
          dni: '35123457',
          phone: '+5492284123457',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);
      const query = Object.assign(new ListOrganizerPlayersDto(), {
        q: 'Ada',
        limit: 1,
      });

      const result = await service.listForOrganizer(query);

      expect(prisma.player.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { firstName: { contains: 'Ada', mode: 'insensitive' } },
            { lastName: { contains: 'Ada', mode: 'insensitive' } },
          ],
        },
        orderBy: { id: 'desc' },
        take: 2,
      });
      expect(result).toEqual({
        items: [
          {
            id: '019aaa00-0000-7000-8000-000000000002',
            firstName: 'Ada',
            lastName: 'Lovelace',
            category: 'Open',
            gender: 'female',
            createdAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        nextCursor: '019aaa00-0000-7000-8000-000000000002',
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

    /**
     * La forma que produce de verdad `@prisma/adapter-pg`: **sin
     * `meta.target`**. Los tres tests de arriba mockean `target` y pasaban
     * igual con el chequeo roto, que no podía disparar nunca en producción.
     * Estos dos son los que prueban el mapeo contra lo que llega de verdad —
     * ver la entrada del 2026-09-06 en `docs/decisions.md`.
     */
    function adapterP2002Error(
      fields: string[],
    ): Prisma.PrismaClientKnownRequestError {
      return new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.9.1',
          meta: {
            modelName: 'User',
            driverAdapterError: {
              name: 'DriverAdapterError',
              cause: {
                originalCode: '23505',
                originalMessage:
                  'duplicate key value violates unique constraint',
                kind: 'UniqueConstraintViolation',
                constraint: { fields },
              },
            },
          },
        },
      );
    }

    it('maps the real driver-adapter shape on the dni column', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(adapterP2002Error(['dni']));

      await expect(service.register(createDto())).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'dni_has_account',
        }) as unknown,
      });
    });

    it('maps the real driver-adapter shape on the email column', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.player.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(adapterP2002Error(['email']));

      await expect(service.register(createDto())).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'email_registered',
        }) as unknown,
      });
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

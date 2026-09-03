import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildSlugCandidates,
  ClubsService,
  DEFAULT_PLAN,
  DEFAULT_SUBSCRIPTION_STATUS,
  PLAN_MAX_TOURNAMENTS,
} from './clubs.service';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';

type PrismaMock = {
  $transaction: jest.Mock;
  club: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  subscription: { create: jest.Mock; findUnique: jest.Mock };
};

const CLUB_ROW = {
  id: 'club-1',
  ownerId: 'user-1',
  name: 'Club Ñandú',
  slug: 'club-nandu',
  status: 'active' as const,
  createdAt: new Date('2026-08-24T12:00:00.000Z'),
  updatedAt: new Date('2026-08-24T12:00:00.000Z'),
};

const SUBSCRIPTION_ROW = {
  id: 'subscription-1',
  userId: 'user-1',
  plan: 'basic' as const,
  status: 'pending' as const,
  maxTournaments: 3,
  createdAt: new Date('2026-08-24T12:00:00.000Z'),
  updatedAt: new Date('2026-08-24T12:00:00.000Z'),
};

function createDto(name = 'Club Ñandú'): CreateClubDto {
  const dto = new CreateClubDto();
  dto.name = name;
  return dto;
}

/**
 * `.mock.calls` de un `jest.Mock` sin generics tipa cada entrada como
 * `any`. Se pasa por `unknown` antes de castear — mismo helper que
 * `players.service.spec.ts`.
 */
function lastArgument<T>(mockFn: jest.Mock): T {
  const calls = mockFn.mock.calls as unknown[][];
  return calls[calls.length - 1][0] as T;
}

function uniqueViolation(
  target: string[],
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

describe('ClubsService', () => {
  let service: ClubsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(prisma),
      ),
      club: {
        create: jest.fn().mockResolvedValue(CLUB_ROW),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      subscription: {
        create: jest.fn().mockResolvedValue(SUBSCRIPTION_ROW),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    service = new ClubsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates the club and its subscription in a single transaction', async () => {
      await service.create('user-1', createDto());

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.subscription.create).toHaveBeenCalledTimes(1);
      expect(prisma.club.create).toHaveBeenCalledTimes(1);
    });

    it('takes the owner id from the caller, never from the payload', async () => {
      await service.create('user-1', createDto());

      const call = lastArgument<{ data: { ownerId: string } }>(
        prisma.club.create,
      );
      expect(call.data.ownerId).toBe('user-1');
    });

    it('starts the subscription on the default plan with its quota', async () => {
      await service.create('user-1', createDto());

      const call = lastArgument<{
        data: { plan: string; maxTournaments: number; status: string };
      }>(prisma.subscription.create);
      expect(call.data.plan).toBe(DEFAULT_PLAN);
      expect(call.data.maxTournaments).toBe(PLAN_MAX_TOURNAMENTS[DEFAULT_PLAN]);
      expect(call.data.status).toBe(DEFAULT_SUBSCRIPTION_STATUS);
    });

    // Fijado como test propio y no como un `expect` más arriba: el plan de
    // entrada es gratuito, así que nace **activo** — no hay pago que esperar.
    // Si alguien lo devuelve a `pending`, todo club nuevo queda sin poder
    // crear torneos el día que exista un gate por estado.
    it('starts a free-plan subscription already active', async () => {
      await service.create('user-1', createDto());

      const call = lastArgument<{
        data: { plan: string; status: string };
      }>(prisma.subscription.create);
      expect(call.data.plan).toBe('free');
      expect(call.data.status).toBe('active');
    });

    it('derives the slug from the club name', async () => {
      await service.create('user-1', createDto('Club Atletico Sarmiento'));

      const call = lastArgument<{ data: { slug: string } }>(prisma.club.create);
      expect(call.data.slug).toBe('club-atletico-sarmiento');
    });

    it('suffixes the derived slug when the base one is taken', async () => {
      prisma.club.findMany.mockResolvedValue([{ slug: 'club-nandu' }]);

      await service.create('user-1', createDto());

      const call = lastArgument<{ data: { slug: string } }>(prisma.club.create);
      expect(call.data.slug).toBe('club-nandu-2');
    });

    it('rejects with 409 slug_taken when every derived candidate is taken', async () => {
      prisma.club.findMany.mockResolvedValue(
        buildSlugCandidates('club-nandu').map((slug) => ({ slug })),
      );

      await expect(service.create('user-1', createDto())).rejects.toMatchObject(
        {
          status: 409,
          response: expect.objectContaining({ code: 'slug_taken' }) as unknown,
        },
      );
      expect(prisma.club.create).not.toHaveBeenCalled();
    });

    it('rejects with 409 club_limit_reached when the account already has a subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'subscription-1',
      });

      await expect(service.create('user-1', createDto())).rejects.toMatchObject(
        {
          status: 409,
          response: expect.objectContaining({
            code: 'club_limit_reached',
          }) as unknown,
        },
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // El chequeo de cuota de arriba es solo para el mensaje. La garantía
    // real bajo concurrencia es el índice único de `subscriptions.user_id`,
    // y este test cubre el camino en que dos requests lo cruzan.
    it('maps a unique violation on subscriptions.user_id to the same 409', async () => {
      prisma.subscription.create.mockRejectedValue(
        uniqueViolation(['user_id']),
      );

      await expect(service.create('user-1', createDto())).rejects.toMatchObject(
        {
          status: 409,
          response: expect.objectContaining({
            code: 'club_limit_reached',
          }) as unknown,
        },
      );
    });

    it('maps a unique violation on clubs.slug to 409 slug_taken', async () => {
      prisma.club.create.mockRejectedValue(uniqueViolation(['slug']));

      await expect(service.create('user-1', createDto())).rejects.toMatchObject(
        {
          status: 409,
          response: expect.objectContaining({ code: 'slug_taken' }) as unknown,
        },
      );
    });

    // Un target que no reconocemos no se disfraza de 409.
    it('lets an unrecognized unique violation bubble up', async () => {
      const error = uniqueViolation(['something_else']);
      prisma.club.create.mockRejectedValue(error);

      await expect(service.create('user-1', createDto())).rejects.toBe(error);
    });
  });

  describe('findByClubId', () => {
    it('returns the club with its owner subscription', async () => {
      prisma.club.findUnique.mockResolvedValue({
        ...CLUB_ROW,
        owner: { subscription: SUBSCRIPTION_ROW },
      });

      const response = await service.findByClubId('club-1');

      expect(response.id).toBe('club-1');
      expect(response.subscription.maxTournaments).toBe(3);
    });

    it('scopes the read by the club id it was given', async () => {
      prisma.club.findUnique.mockResolvedValue({
        ...CLUB_ROW,
        owner: { subscription: SUBSCRIPTION_ROW },
      });

      await service.findByClubId('club-1');

      const call = lastArgument<{ where: { id: string } }>(
        prisma.club.findUnique,
      );
      expect(call.where).toEqual({ id: 'club-1' });
    });

    // Un club sin suscripción es corrupción, no un estado que el frontend
    // tenga que modelar: 500, nunca `subscription: null`.
    it('fails with 500 when the club has no subscription', async () => {
      prisma.club.findUnique.mockResolvedValue({
        ...CLUB_ROW,
        owner: { subscription: null },
      });

      await expect(service.findByClubId('club-1')).rejects.toMatchObject({
        status: 500,
      });
    });

    it('fails with 500 when the guard resolved a club that no longer exists', async () => {
      prisma.club.findUnique.mockResolvedValue(null);

      await expect(service.findByClubId('club-1')).rejects.toMatchObject({
        status: 500,
      });
    });
  });

  describe('update', () => {
    it('updates the name of the scoped club', async () => {
      prisma.club.update.mockResolvedValue({
        ...CLUB_ROW,
        name: 'Club Nuevo',
        owner: { subscription: SUBSCRIPTION_ROW },
      });

      const dto = new UpdateClubDto();
      dto.name = 'Club Nuevo';
      const response = await service.update('club-1', dto);

      const call = lastArgument<{
        where: { id: string };
        data: { name: string };
      }>(prisma.club.update);
      expect(call.where).toEqual({ id: 'club-1' });
      expect(call.data).toEqual({ name: 'Club Nuevo' });
      expect(response.name).toBe('Club Nuevo');
    });

    // Un `update` con `data: {}` tocaría `updated_at` por el `@updatedAt`
    // del schema: un no-op del cliente mentiría en la respuesta.
    it('does not write anything when the payload is empty', async () => {
      prisma.club.findUnique.mockResolvedValue({
        ...CLUB_ROW,
        owner: { subscription: SUBSCRIPTION_ROW },
      });

      const response = await service.update('club-1', new UpdateClubDto());

      expect(prisma.club.update).not.toHaveBeenCalled();
      expect(response.id).toBe('club-1');
    });
  });
});

describe('buildSlugCandidates', () => {
  it('returns the base slug followed by its numbered variants', () => {
    expect(buildSlugCandidates('club-nandu')).toEqual([
      'club-nandu',
      'club-nandu-2',
      'club-nandu-3',
      'club-nandu-4',
      'club-nandu-5',
    ]);
  });

  // Un club llamado "Me" derivaría `me`, que ambiguaría `GET /clubs/me` el
  // día que exista `GET /clubs/:slug`.
  it('drops candidates that collide with a reserved route segment', () => {
    expect(buildSlugCandidates('me')).toEqual(['me-2', 'me-3', 'me-4', 'me-5']);
  });

  it('keeps every suffixed candidate within the maximum slug length', () => {
    const candidates = buildSlugCandidates('a'.repeat(50));

    for (const candidate of candidates) {
      expect(candidate.length).toBeLessThanOrEqual(50);
    }
  });

  it('does not leave a dangling hyphen when the suffix truncates the base', () => {
    const candidates = buildSlugCandidates(`${'a'.repeat(47)}-bc`);

    for (const candidate of candidates) {
      expect(candidate).not.toContain('--');
    }
  });
});

import { PrismaService } from '../prisma/prisma.service';
import { TournamentStatus } from '../generated/prisma/enums';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentsService } from './tournaments.service';

type PrismaMock = {
  $transaction: jest.Mock;
  club: { findUnique: jest.Mock };
  tournament: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

const TOURNAMENT_ROW = {
  id: 'tournament-1',
  clubId: 'club-1',
  name: 'Apertura 2026',
  format: 'single_elimination' as const,
  status: 'open' as const,
  createdAt: new Date('2026-08-24T12:00:00.000Z'),
  updatedAt: new Date('2026-08-24T12:00:00.000Z'),
};

function createDto(name = 'Apertura 2026'): CreateTournamentDto {
  const dto = new CreateTournamentDto();
  dto.name = name;
  return dto;
}

function clubWithQuota(maxTournaments: number) {
  return { owner: { subscription: { maxTournaments } } };
}

/**
 * `.mock.calls` de un `jest.Mock` sin generics tipa cada entrada como
 * `any`. Se pasa por `unknown` antes de castear — mismo helper que
 * `clubs.service.spec.ts`.
 */
function lastArgument<T>(mockFn: jest.Mock): T {
  const calls = mockFn.mock.calls as unknown[][];
  return calls[calls.length - 1][0] as T;
}

describe('TournamentsService', () => {
  let service: TournamentsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(prisma),
      ),
      club: { findUnique: jest.fn() },
      tournament: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new TournamentsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates the tournament when the club is under its active-tournaments quota', async () => {
      prisma.club.findUnique.mockResolvedValue(clubWithQuota(3));
      prisma.tournament.count.mockResolvedValue(2);
      prisma.tournament.create.mockResolvedValue(TOURNAMENT_ROW);

      const response = await service.create('club-1', createDto());

      expect(response.id).toBe('tournament-1');
      expect(prisma.tournament.create).toHaveBeenCalledTimes(1);
    });

    // El borde exacto: al llegar a `max` (no al superarlo) ya no hay cupo.
    it('rejects with 409 tournament_quota_reached once current equals max, and details the numbers', async () => {
      prisma.club.findUnique.mockResolvedValue(clubWithQuota(3));
      prisma.tournament.count.mockResolvedValue(3);

      await expect(service.create('club-1', createDto())).rejects.toMatchObject(
        {
          status: 409,
          response: expect.objectContaining({
            code: 'tournament_quota_reached',
            details: { max: 3, current: 3 },
          }) as unknown,
        },
      );
      expect(prisma.tournament.create).not.toHaveBeenCalled();
    });

    // La cuota cuenta llaves activas simultáneas: un torneo `finished` o
    // `canceled` no puede seguir ocupando el cupo.
    it('counts only tournaments with an active status (open, in_progress) for the quota', async () => {
      prisma.club.findUnique.mockResolvedValue(clubWithQuota(3));
      prisma.tournament.count.mockResolvedValue(0);
      prisma.tournament.create.mockResolvedValue(TOURNAMENT_ROW);

      await service.create('club-1', createDto());

      const call = lastArgument<{
        where: { clubId: string; status: { in: TournamentStatus[] } };
      }>(prisma.tournament.count);
      expect(call.where).toEqual({
        clubId: 'club-1',
        status: { in: ['open', 'in_progress'] },
      });
    });

    // `ClubScopeGuard` ya resolvió que la cuenta tiene club: llegar acá sin
    // que exista es corrupción entre el auth y el handler, no un 404.
    it('fails with 500 when the club resolved by the guard no longer exists', async () => {
      prisma.club.findUnique.mockResolvedValue(null);

      await expect(service.create('club-1', createDto())).rejects.toMatchObject(
        { status: 500 },
      );
      expect(prisma.tournament.create).not.toHaveBeenCalled();
    });

    // Todo club nace con su suscripción en la misma transacción
    // (`ClubsService.create`): sin ella no hay cuota que aplicar, y asumir
    // un default silencioso regalaría torneos ilimitados.
    it('fails with 500 when the club has no subscription', async () => {
      prisma.club.findUnique.mockResolvedValue({
        owner: { subscription: null },
      });

      await expect(service.create('club-1', createDto())).rejects.toMatchObject(
        { status: 500 },
      );
      expect(prisma.tournament.create).not.toHaveBeenCalled();
    });
  });

  describe('tenancy scope (findOne, update)', () => {
    it('rejects with 404 tournament_not_found when the tournament belongs to another club or does not exist', async () => {
      prisma.tournament.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('club-1', 'someone-elses-tournament'),
      ).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({
          code: 'tournament_not_found',
        }) as unknown,
      });
    });

    it('scopes the lookup by clubId in the same query, not by comparing after the read', async () => {
      prisma.tournament.findFirst.mockResolvedValue(TOURNAMENT_ROW);

      await service.findOne('club-1', 'tournament-1');

      const call = lastArgument<{ where: { id: string; clubId: string } }>(
        prisma.tournament.findFirst,
      );
      expect(call.where).toEqual({ id: 'tournament-1', clubId: 'club-1' });
    });
  });

  describe('update', () => {
    function updateDto(
      overrides: Partial<UpdateTournamentDto>,
    ): UpdateTournamentDto {
      const dto = new UpdateTournamentDto();
      Object.assign(dto, overrides);
      return dto;
    }

    it.each<[TournamentStatus, TournamentStatus]>([
      ['open', 'canceled'],
      ['in_progress', 'canceled'],
    ])('allows the %s -> %s transition', async (from, to) => {
      prisma.tournament.findFirst.mockResolvedValue({
        ...TOURNAMENT_ROW,
        status: from,
      });
      prisma.tournament.update.mockResolvedValue({
        ...TOURNAMENT_ROW,
        status: to,
      });

      const response = await service.update(
        'club-1',
        'tournament-1',
        updateDto({ status: to }),
      );

      expect(response.status).toBe(to);
      const call = lastArgument<{ data: { status?: TournamentStatus } }>(
        prisma.tournament.update,
      );
      expect(call.data.status).toBe(to);
    });

    it.each<[TournamentStatus, TournamentStatus]>([
      // Ya terminado: no hay llave que invalidar, pero tampoco es un no-op
      // silencioso.
      ['finished', 'canceled'],
      // El único camino a `finished` es el cierre del último partido, no un
      // `PATCH` a mano.
      ['open', 'finished'],
      // Un torneo cancelado no revive.
      ['canceled', 'open'],
    ])(
      'rejects the %s -> %s transition with 409 invalid_status_transition',
      async (from, to) => {
        prisma.tournament.findFirst.mockResolvedValue({
          ...TOURNAMENT_ROW,
          status: from,
        });

        await expect(
          service.update('club-1', 'tournament-1', updateDto({ status: to })),
        ).rejects.toMatchObject({
          status: 409,
          response: expect.objectContaining({
            code: 'invalid_status_transition',
            details: { from, to },
          }) as unknown,
        });
        expect(prisma.tournament.update).not.toHaveBeenCalled();
      },
    );

    // El nombre es una etiqueta, no parte de la máquina de estados: se puede
    // corregir sin importar en qué estado quedó el torneo.
    it.each<TournamentStatus>(['open', 'in_progress', 'finished', 'canceled'])(
      'allows renaming a tournament that is %s',
      async (status) => {
        prisma.tournament.findFirst.mockResolvedValue({
          ...TOURNAMENT_ROW,
          status,
        });
        prisma.tournament.update.mockResolvedValue({
          ...TOURNAMENT_ROW,
          status,
          name: 'Nombre Nuevo',
        });

        const response = await service.update(
          'club-1',
          'tournament-1',
          updateDto({ name: 'Nombre Nuevo' }),
        );

        expect(response.name).toBe('Nombre Nuevo');
        expect(response.status).toBe(status);
        const call = lastArgument<{ data: { name?: string; status?: string } }>(
          prisma.tournament.update,
        );
        expect(call.data).toEqual({ name: 'Nombre Nuevo' });
      },
    );

    it('rejects with 404 tournament_not_found when the tournament is from another club', async () => {
      prisma.tournament.findFirst.mockResolvedValue(null);

      await expect(
        service.update(
          'club-1',
          'someone-elses-tournament',
          updateDto({ name: 'x' }),
        ),
      ).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({
          code: 'tournament_not_found',
        }) as unknown,
      });
      expect(prisma.tournament.update).not.toHaveBeenCalled();
    });

    // Un `update` con `data: {}` igual tocaría `updated_at` por el
    // `@updatedAt` del schema: un no-op del cliente mentiría en la
    // respuesta si se dejara pasar.
    it('is a no-op that returns the current state when the body is empty', async () => {
      prisma.tournament.findFirst.mockResolvedValue(TOURNAMENT_ROW);

      const response = await service.update(
        'club-1',
        'tournament-1',
        updateDto({}),
      );

      expect(prisma.tournament.update).not.toHaveBeenCalled();
      expect(response.id).toBe('tournament-1');
    });
  });
});

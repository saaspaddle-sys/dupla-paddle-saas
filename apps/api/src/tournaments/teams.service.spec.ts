import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { canonicalPair, TeamsService } from './teams.service';

type PrismaMock = {
  $transaction: jest.Mock;
  tournament: { findFirst: jest.Mock };
  player: { findMany: jest.Mock };
  team: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
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

// 'a' < 'b': ya nacen en orden canónico para no confundir los tests que no
// prueban el orden en sí mismo.
const PLAYER_A = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  firstName: 'Juan',
  lastName: 'Pérez',
  category: 'C4',
};
const PLAYER_B = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  firstName: 'Ana',
  lastName: 'Gómez',
  category: 'C5',
};

const TEAM_ROW = {
  id: 'team-1',
  clubId: 'club-1',
  tournamentId: 'tournament-1',
  player1Id: PLAYER_A.id,
  player2Id: PLAYER_B.id,
  createdAt: new Date('2026-08-24T12:05:00.000Z'),
  updatedAt: new Date('2026-08-24T12:05:00.000Z'),
  player1: PLAYER_A,
  player2: PLAYER_B,
};

function createDto(
  player1Id: string = PLAYER_A.id,
  player2Id: string = PLAYER_B.id,
): CreateTeamDto {
  const dto = new CreateTeamDto();
  dto.player1Id = player1Id;
  dto.player2Id = player2Id;
  return dto;
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

describe('TeamsService', () => {
  let service: TeamsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(prisma),
      ),
      tournament: { findFirst: jest.fn().mockResolvedValue(TOURNAMENT_ROW) },
      player: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: PLAYER_A.id }, { id: PLAYER_B.id }]),
      },
      team: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(TEAM_ROW),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new TeamsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('registers the team and returns the mapped response', async () => {
      const response = await service.create(
        'club-1',
        'tournament-1',
        createDto(),
      );

      expect(response.id).toBe('team-1');
      expect(response.tournamentId).toBe('tournament-1');
      expect(response.player1.id).toBe(PLAYER_A.id);
      expect(response.player2.id).toBe(PLAYER_B.id);
    });

    it.each(['in_progress', 'finished', 'canceled'] as const)(
      'rejects with 409 tournament_not_open when the tournament is %s',
      async (status) => {
        prisma.tournament.findFirst.mockResolvedValue({
          ...TOURNAMENT_ROW,
          status,
        });

        await expect(
          service.create('club-1', 'tournament-1', createDto()),
        ).rejects.toMatchObject({
          status: 409,
          response: expect.objectContaining({
            code: 'tournament_not_open',
          }) as unknown,
        });
        expect(prisma.team.create).not.toHaveBeenCalled();
      },
    );

    it('rejects with 404 tournament_not_found when the tournament is from another club', async () => {
      prisma.tournament.findFirst.mockResolvedValue(null);

      await expect(
        service.create('club-1', 'someone-elses-tournament', createDto()),
      ).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({
          code: 'tournament_not_found',
        }) as unknown,
      });
    });

    // El `details.playerIds` dice cuál de los dos falta: sin esto el
    // cliente tendría que adivinar si el id malo es el que tipeó o el que
    // eligió de una lista.
    it('rejects with 404 player_not_found and details which player is missing', async () => {
      prisma.player.findMany.mockResolvedValue([{ id: PLAYER_A.id }]);

      await expect(
        service.create('club-1', 'tournament-1', createDto()),
      ).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({
          code: 'player_not_found',
          details: { playerIds: [PLAYER_B.id] },
        }) as unknown,
      });
      expect(prisma.team.create).not.toHaveBeenCalled();
    });

    it('rejects with 409 duplicate_team when the exact same pair is already registered', async () => {
      prisma.team.findFirst.mockResolvedValue({
        player1Id: PLAYER_A.id,
        player2Id: PLAYER_B.id,
      });

      await expect(
        service.create('club-1', 'tournament-1', createDto()),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'duplicate_team',
        }) as unknown,
      });
      expect(prisma.team.create).not.toHaveBeenCalled();
    });

    // Distinto del duplicado exacto: acá el choque es un jugador que ya
    // juega en *otra* dupla del torneo, y `details.playerIds` dice cuál.
    it('rejects with 409 player_already_registered when a player already plays in a different team', async () => {
      const someoneElseId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      prisma.team.findFirst.mockResolvedValue({
        player1Id: PLAYER_A.id,
        player2Id: someoneElseId,
      });

      await expect(
        service.create('club-1', 'tournament-1', createDto()),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'player_already_registered',
          details: { playerIds: [PLAYER_A.id] },
        }) as unknown,
      });
      expect(prisma.team.create).not.toHaveBeenCalled();
    });

    // (A, B) y (B, A) tienen que terminar como la misma fila: sin esto el
    // índice único de la base no sirve de nada.
    it('inserts the pair in canonical order regardless of the order the client sent them', async () => {
      await service.create(
        'club-1',
        'tournament-1',
        createDto(PLAYER_B.id, PLAYER_A.id),
      );

      const call = lastArgument<{
        data: { player1Id: string; player2Id: string };
      }>(prisma.team.create);
      expect(call.data.player1Id).toBe(PLAYER_A.id);
      expect(call.data.player2Id).toBe(PLAYER_B.id);
    });

    // El mock de `findFirst` no filtra de verdad por `clubId` (a diferencia
    // de Postgres): devuelve el torneo pase lo que pase. Si el service
    // escribiera el `clubId` del parámetro en vez de `tournament.clubId`,
    // este test lo detectaría.
    it('writes the clubId from the loaded tournament, never from the scope argument echoed back', async () => {
      prisma.tournament.findFirst.mockResolvedValue({
        ...TOURNAMENT_ROW,
        clubId: 'club-from-the-loaded-tournament',
      });

      await service.create(
        'club-that-is-not-what-gets-written',
        'tournament-1',
        createDto(),
      );

      const call = lastArgument<{ data: { clubId: string } }>(
        prisma.team.create,
      );
      expect(call.data.clubId).toBe('club-from-the-loaded-tournament');
    });
  });

  describe('remove', () => {
    it('deletes the team scoped by team, tournament and club in the same statement', async () => {
      await service.remove('club-1', 'tournament-1', 'team-1');

      const call = lastArgument<{
        where: { id: string; tournamentId: string; clubId: string };
      }>(prisma.team.deleteMany);
      expect(call.where).toEqual({
        id: 'team-1',
        tournamentId: 'tournament-1',
        clubId: 'club-1',
      });
    });

    it('rejects with 404 team_not_found when nothing matched the delete', async () => {
      prisma.team.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.remove('club-1', 'tournament-1', 'unknown-team'),
      ).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({
          code: 'team_not_found',
        }) as unknown,
      });
    });

    it('rejects with 409 tournament_not_open when the tournament is no longer open', async () => {
      prisma.tournament.findFirst.mockResolvedValue({
        ...TOURNAMENT_ROW,
        status: 'canceled',
      });

      await expect(
        service.remove('club-1', 'tournament-1', 'team-1'),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'tournament_not_open',
        }) as unknown,
      });
      expect(prisma.team.deleteMany).not.toHaveBeenCalled();
    });
  });
});

describe('canonicalPair', () => {
  it('reorders a descending pair into ascending order', () => {
    expect(canonicalPair('b-id', 'a-id')).toEqual(['a-id', 'b-id']);
  });

  it('is idempotent', () => {
    const once = canonicalPair('b-id', 'a-id');

    expect(canonicalPair(once[0], once[1])).toEqual(once);
  });

  /**
   * REGRESIÓN. Comparar los strings crudos (sin normalizar a minúscula)
   * daría el orden contrario al que exige la base: en el orden de strings
   * de JavaScript, 'F' (0x46) es menor que 'a' (0x61), así que
   * `'FFFF...' < 'aaaa...'`. Pero Postgres ordena `uuid` por sus 16 bytes,
   * y ahí un dígito hexadecimal es case-insensitive — el byte de `f`/`F` es
   * mayor que el de `a`/`A` en cualquiera de los dos casings, así que
   * `'ffff...' > 'aaaa...'` para el `CHECK teams_canonical_order`. Sin
   * normalizar antes de comparar, este par se insertaría en el orden que
   * JavaScript eligió (F primero), que es el que ese `CHECK` rechaza como
   * un 500.
   */
  it('sorts by the lowercase value, matching Postgres uuid byte order rather than raw JS string order', () => {
    const upper = 'FFFFFFFF-FFFF-4FFF-8FFF-FFFFFFFFFFFF';
    const lower = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    // Orden de strings crudo (lo que este test demuestra que NO hay que
    // hacer): 'F' < 'a', así que compararlos tal cual daría [upper, lower].
    expect(upper < lower).toBe(true);

    // Orden real que exige el CHECK de la base: el `aaaa...` (en minúscula)
    // va primero.
    expect(canonicalPair(upper, lower)).toEqual([lower, upper.toLowerCase()]);
  });
});

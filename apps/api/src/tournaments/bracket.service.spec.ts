import { Shuffle } from '../matches/bracket.builder';
import { PrismaService } from '../prisma/prisma.service';
import { BracketService } from './bracket.service';

type PrismaMock = {
  $transaction: jest.Mock;
  tournament: { findFirst: jest.Mock; updateMany: jest.Mock };
  team: { findMany: jest.Mock };
  match: { createManyAndReturn: jest.Mock; findMany: jest.Mock };
};

const TOURNAMENT_ROW = {
  id: 'tournament-1',
  clubId: 'club-1',
  name: 'Apertura 2026',
  format: 'single_elimination' as const,
  status: 'open' as const,
  createdAt: new Date('2026-09-01T12:00:00.000Z'),
  updatedAt: new Date('2026-09-01T12:00:00.000Z'),
};

/** Barajado que no baraja: el sorteo entra por DI justamente para esto. */
const identityShuffle: Shuffle = <T>(items: readonly T[]): T[] => [...items];

function teamRows(
  count: number,
  seeds: Record<number, number> = {},
): { id: string; seed: number | null }[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    seed: seeds[index + 1] ?? null,
  }));
}

interface CreatedRow {
  round: number;
  position: number;
  teamAId: string | null;
  teamBId: string | null;
  status: string;
  outcome: string | null;
  winnerTeamId: string | null;
  nextMatchId: string | null;
  nextSlot: string | null;
}

function createCalls(prisma: PrismaMock): CreatedRow[][] {
  const calls = prisma.match.createManyAndReturn.mock.calls as unknown[][];
  return calls.map((call) => (call[0] as { data: CreatedRow[] }).data);
}

describe('BracketService', () => {
  let service: BracketService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((handler: (tx: unknown) => unknown) =>
        handler(prisma),
      ),
      tournament: {
        findFirst: jest.fn().mockResolvedValue(TOURNAMENT_ROW),
        // El compare-and-swap toma el torneo: una fila actualizada.
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      team: { findMany: jest.fn().mockResolvedValue(teamRows(4)) },
      match: {
        // Devuelve ids derivados de las coordenadas para poder afirmar el
        // cableado de los punteros sin adivinar UUIDs.
        createManyAndReturn: jest.fn(
          (args: { data: { round: number; position: number }[] }) =>
            args.data.map((row) => ({
              id: `m-r${row.round}-p${row.position}`,
              position: row.position,
            })),
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new BracketService(
      prisma as unknown as PrismaService,
      identityShuffle,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('persistence order', () => {
    /**
     * El test que sostiene el diseño. `next_match_id` es una FK contra
     * `matches`, así que el destino tiene que existir cuando se inserta el
     * que lo apunta: escribir de la primera ronda hacia adelante fallaría
     * contra la base. Si alguien "optimiza" esto a un solo `createMany`, este
     * test es el que lo frena.
     */
    it('writes the rounds from the final backwards', async () => {
      await service.generate('club-1', 'tournament-1');

      const rounds = createCalls(prisma).map((rows) => rows[0].round);
      expect(rounds).toEqual([2, 1]);
    });

    it('points every match at one already inserted in the previous query', async () => {
      await service.generate('club-1', 'tournament-1');

      const [final, firstRound] = createCalls(prisma);

      // La final no avanza a ningún lado, y los dos campos van juntos: el
      // CHECK `matches_next_pointer` no admite medio puntero.
      expect(final).toHaveLength(1);
      expect(final[0].nextMatchId).toBeNull();
      expect(final[0].nextSlot).toBeNull();

      // Los dos partidos de primera ronda alimentan la final, uno por lado.
      expect(firstRound).toHaveLength(2);
      for (const row of firstRound) {
        expect(row.nextMatchId).toBe('m-r2-p0');
      }
      expect(firstRound.map((row) => row.nextSlot)).toEqual(['a', 'b']);
    });

    it('opens a bye already closed, with its three columns consistent', async () => {
      // 3 duplas en un cuadro de 4: sobra un lugar, y va a la sembrada.
      prisma.team.findMany.mockResolvedValue(teamRows(3, { 1: 1 }));

      await service.generate('club-1', 'tournament-1');

      const firstRound = createCalls(prisma)[1];
      const bye = firstRound.find((row) => row.outcome === 'bye');

      // El CHECK `matches_status_outcome` exige los tres juntos, así que se
      // afirman los tres.
      expect(bye).toBeDefined();
      expect(bye?.status).toBe('finished');
      expect(bye?.teamBId).toBeNull();
      expect(bye?.winnerTeamId).toBe(bye?.teamAId);
    });
  });

  describe('closing registration', () => {
    /**
     * El orden importa y no es cosmético: mientras el torneo siga `open`,
     * `TeamsService` acepta inscripciones. Leer las duplas antes de cerrar
     * dejaría afuera del cuadro a una que la API ya aceptó.
     */
    it('takes the tournament before reading the teams', async () => {
      const order: string[] = [];
      prisma.tournament.updateMany.mockImplementation(() => {
        order.push('claim');
        return Promise.resolve({ count: 1 });
      });
      prisma.team.findMany.mockImplementation(() => {
        order.push('read-teams');
        return Promise.resolve(teamRows(4));
      });

      await service.generate('club-1', 'tournament-1');

      expect(order).toEqual(['claim', 'read-teams']);
    });

    it('claims it with a compare-and-swap conditioned on the open status', async () => {
      await service.generate('club-1', 'tournament-1');

      const calls = prisma.tournament.updateMany.mock.calls as unknown[][];
      expect(calls[0][0]).toEqual({
        where: { id: 'tournament-1', clubId: 'club-1', status: 'open' },
        data: { status: 'in_progress' },
      });
    });

    it('rejects with 409 bracket_already_exists when the swap updates nothing', async () => {
      prisma.tournament.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.generate('club-1', 'tournament-1'),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'bracket_already_exists',
        }) as unknown,
      });
      expect(prisma.match.createManyAndReturn).not.toHaveBeenCalled();
    });
  });

  describe('preconditions', () => {
    it('rejects with 409 bracket_already_exists when the tournament is in_progress', async () => {
      prisma.tournament.findFirst.mockResolvedValue({
        ...TOURNAMENT_ROW,
        status: 'in_progress',
      });

      await expect(
        service.generate('club-1', 'tournament-1'),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'bracket_already_exists',
        }) as unknown,
      });
      expect(prisma.tournament.updateMany).not.toHaveBeenCalled();
    });

    it.each(['finished', 'canceled'] as const)(
      'rejects with 409 tournament_not_open when the tournament is %s',
      async (status) => {
        prisma.tournament.findFirst.mockResolvedValue({
          ...TOURNAMENT_ROW,
          status,
        });

        await expect(
          service.generate('club-1', 'tournament-1'),
        ).rejects.toMatchObject({
          status: 409,
          response: expect.objectContaining({
            code: 'tournament_not_open',
          }) as unknown,
        });
      },
    );

    it('rejects with 404 tournament_not_found before touching anything', async () => {
      prisma.tournament.findFirst.mockResolvedValue(null);

      await expect(
        service.generate('club-1', 'other-tournament'),
      ).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({
          code: 'tournament_not_found',
        }) as unknown,
      });
      expect(prisma.tournament.updateMany).not.toHaveBeenCalled();
    });

    it.each([[0], [1]])(
      'rejects with 409 not_enough_teams for %i teams',
      async (count) => {
        prisma.team.findMany.mockResolvedValue(teamRows(count));

        await expect(
          service.generate('club-1', 'tournament-1'),
        ).rejects.toMatchObject({
          status: 409,
          response: expect.objectContaining({
            code: 'not_enough_teams',
            details: { teamCount: count, minimum: 2 },
          }) as unknown,
        });
      },
    );

    it('rejects with 409 too_many_teams past the bracket ceiling', async () => {
      prisma.team.findMany.mockResolvedValue(teamRows(129));

      await expect(
        service.generate('club-1', 'tournament-1'),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'too_many_teams',
          details: { teamCount: 129, maximum: 128 },
        }) as unknown,
      });
    });
  });

  describe('seeding', () => {
    it('accepts seeds that run 1..k with the rest unseeded', async () => {
      prisma.team.findMany.mockResolvedValue(teamRows(4, { 1: 2, 3: 1 }));

      await expect(
        service.generate('club-1', 'tournament-1'),
      ).resolves.toBeDefined();
    });

    it('accepts a tournament with no seeded teams at all', async () => {
      prisma.team.findMany.mockResolvedValue(teamRows(4));

      await expect(
        service.generate('club-1', 'tournament-1'),
      ).resolves.toBeDefined();
    });

    // Con seeds 1, 2 y 7 la posición 3 del cuadro quedaría vacía mientras
    // existe una cabeza 7. Es un error del club, no un cuadro que la API deba
    // inventar.
    it.each([
      [{ 1: 1, 2: 3 }, [1, 3]],
      [{ 1: 2 }, [2]],
      [{ 1: 1, 2: 2, 3: 7 }, [1, 2, 7]],
    ])('rejects seeds with a gap (%p)', async (seeds, expected) => {
      prisma.team.findMany.mockResolvedValue(teamRows(4, seeds));

      await expect(
        service.generate('club-1', 'tournament-1'),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'invalid_seeding',
          details: { seeds: expected },
        }) as unknown,
      });
      expect(prisma.match.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('places the seeded teams in the protected slots of the draw', async () => {
      prisma.team.findMany.mockResolvedValue(teamRows(4, { 1: 1, 2: 2 }));

      await service.generate('club-1', 'tournament-1');

      const firstRound = createCalls(prisma)[1];
      // La 1 y la 2 arrancan en partidos distintos: es lo que hace que solo
      // puedan cruzarse en la final.
      const seedOnePosition = firstRound.find(
        (row) => row.teamAId === 'team-1',
      )?.position;
      const seedTwoPosition = firstRound.find(
        (row) => row.teamAId === 'team-2',
      )?.position;
      expect(seedOnePosition).toBe(0);
      expect(seedTwoPosition).toBe(1);
    });
  });

  it('scopes every write to the club of the authenticated user', async () => {
    await service.generate('club-1', 'tournament-1');

    for (const rows of createCalls(prisma)) {
      for (const row of rows) {
        expect(row).toMatchObject({ round: expect.any(Number) as unknown });
      }
    }
    const calls = prisma.match.createManyAndReturn.mock.calls as unknown[][];
    const everyRow = calls.flatMap(
      (call) => (call[0] as { data: { clubId: string }[] }).data,
    );
    expect(everyRow.every((row) => row.clubId === 'club-1')).toBe(true);
  });
});

import {
  BracketPlan,
  MAX_TEAMS,
  MIN_TEAMS,
  PlannedMatch,
  Shuffle,
  bracketSizeFor,
  planBracket,
  seedOrder,
} from './bracket.builder';

/**
 * Barajado que no baraja. Con sorteo de por medio el generador no cumple
 * "mismo input, mismo output", así que los tests fijan los invariantes del
 * cuadro y usan este para que las corridas sean reproducibles.
 */
const identityShuffle: Shuffle = <T>(items: readonly T[]): T[] => [...items];

/** Barajado que invierte: prueba que ningún invariante dependa del orden. */
const reverseShuffle: Shuffle = <T>(items: readonly T[]): T[] =>
  [...items].reverse();

function teamIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `team-${index + 1}`);
}

function build(
  teamCount: number,
  seededCount = 0,
  shuffle: Shuffle = identityShuffle,
): BracketPlan {
  const all = teamIds(teamCount);
  return planBracket(
    {
      seededTeamIds: all.slice(0, seededCount),
      unseededTeamIds: all.slice(seededCount),
    },
    shuffle,
  );
}

function firstRound(plan: BracketPlan): PlannedMatch[] {
  return plan.matches.filter((match) => match.round === 1);
}

/**
 * Ronda en la que dos duplas se cruzarían si las dos ganaran todo. Es la
 * medida real de si la siembra sirve: sin ella, la 1 y la 2 se pueden cruzar
 * en cualquier ronda.
 */
function meetingRound(plan: BracketPlan, a: string, b: string): number {
  const pathOf = (teamId: string): Map<number, number> => {
    const path = new Map<number, number>();
    let current = firstRound(plan).find(
      (match) => match.teamAId === teamId || match.teamBId === teamId,
    );
    while (current) {
      path.set(current.round, current.position);
      if (current.nextPosition === null) break;
      const nextRound = current.round + 1;
      const nextPosition = current.nextPosition;
      current = plan.matches.find(
        (match) => match.round === nextRound && match.position === nextPosition,
      );
    }
    return path;
  };

  const pathA = pathOf(a);
  const pathB = pathOf(b);
  for (const [round, position] of pathA) {
    if (pathB.get(round) === position) return round;
  }
  throw new Error(`${a} and ${b} never meet`);
}

describe('seedOrder', () => {
  it('produces the standard bracket sequence', () => {
    expect(seedOrder(1)).toEqual([1]);
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedOrder(16)).toEqual([
      1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11,
    ]);
  });

  it('pairs every entrant with exactly one other, summing to size + 1', () => {
    for (const size of [2, 4, 8, 16, 32, 64, 128]) {
      const order = seedOrder(size);
      expect(new Set(order).size).toBe(size);
      for (let i = 0; i < order.length; i += 2) {
        expect(order[i] + order[i + 1]).toBe(size + 1);
        // El primero del par es siempre el menor: por eso el lado A del
        // partido es la mejor entrada y el lado B el único que puede faltar.
        expect(order[i]).toBeLessThan(order[i + 1]);
      }
    }
  });
});

describe('bracketSizeFor', () => {
  it('rounds up to the next power of two', () => {
    expect(bracketSizeFor(2)).toBe(2);
    expect(bracketSizeFor(3)).toBe(4);
    expect(bracketSizeFor(6)).toBe(8);
    expect(bracketSizeFor(8)).toBe(8);
    expect(bracketSizeFor(9)).toBe(16);
    expect(bracketSizeFor(128)).toBe(128);
  });
});

describe('planBracket', () => {
  describe('invariants for every team count from 2 to 128', () => {
    const counts = Array.from(
      { length: MAX_TEAMS - MIN_TEAMS + 1 },
      (_, index) => index + MIN_TEAMS,
    );

    it.each(counts)('holds for %i teams', (teamCount) => {
      const plan = build(teamCount, Math.min(4, teamCount));
      const size = bracketSizeFor(teamCount);

      expect(plan.bracketSize).toBe(size);
      expect(plan.roundCount).toBe(Math.log2(size));
      expect(plan.byeCount).toBe(size - teamCount);
      expect(plan.matches).toHaveLength(size - 1);

      // Ninguna coordenada repetida: el cuadro no tiene huecos ni duplicados.
      const coordinates = plan.matches.map(
        (match) => `${match.round}:${match.position}`,
      );
      expect(new Set(coordinates).size).toBe(plan.matches.length);

      // Cada dupla aparece exactamente una vez en la primera ronda.
      const placed = firstRound(plan)
        .flatMap((match) => [match.teamAId, match.teamBId])
        .filter((id): id is string => id !== null);
      expect(new Set(placed).size).toBe(teamCount);

      // Exactamente los byes que faltan para llenar el cuadro.
      expect(firstRound(plan).filter((match) => match.isBye)).toHaveLength(
        size - teamCount,
      );
    });

    it.each(counts)(
      'never puts a bye on side A, with %i teams',
      (teamCount) => {
        const plan = build(teamCount, Math.min(4, teamCount));
        for (const match of firstRound(plan)) {
          // El lado que puede faltar es siempre el B. De acá sale el CHECK
          // `matches_bye_shape`.
          expect(match.teamAId).not.toBeNull();
          if (match.isBye) expect(match.teamBId).toBeNull();
        }
      },
    );

    it.each(counts)('never faces a bye against a bye, with %i teams', (n) => {
      const plan = build(n, Math.min(4, n));
      // Se cumple solo: como el cuadro es la potencia *siguiente*, siempre hay
      // más duplas que la mitad, así que nunca hace falta el caso especial.
      for (const match of firstRound(plan)) {
        expect(match.teamAId === null && match.teamBId === null).toBe(false);
      }
    });

    it.each(counts)('keeps the tree connected, with %i teams', (teamCount) => {
      const plan = build(teamCount, Math.min(4, teamCount));

      const finals = plan.matches.filter(
        (match) => match.nextPosition === null,
      );
      expect(finals).toHaveLength(1);
      expect(finals[0].round).toBe(plan.roundCount);
      expect(finals[0].position).toBe(0);
      expect(finals[0].nextSlot).toBeNull();

      for (const match of plan.matches) {
        if (match.nextPosition === null) continue;
        const target = plan.matches.find(
          (candidate) =>
            candidate.round === match.round + 1 &&
            candidate.position === match.nextPosition,
        );
        // Todo partido salvo la final apunta a uno que existe.
        expect(target).toBeDefined();
        expect(match.nextSlot).toBe(match.position % 2 === 0 ? 'a' : 'b');
      }

      // Cada partido de una ronda posterior recibe exactamente dos
      // alimentadores: uno por el lado A y otro por el B.
      for (let round = 2; round <= plan.roundCount; round += 1) {
        for (const match of plan.matches.filter((m) => m.round === round)) {
          const feeders = plan.matches.filter(
            (m) => m.round === round - 1 && m.nextPosition === match.position,
          );
          expect(feeders).toHaveLength(2);
          expect(feeders.map((m) => m.nextSlot).sort()).toEqual(['a', 'b']);
        }
      }
    });
  });

  describe('seeding', () => {
    it('lets the top two seeds meet only in the final', () => {
      for (const teamCount of [4, 5, 8, 12, 16, 31, 64, 128]) {
        const plan = build(teamCount, 4);
        expect(meetingRound(plan, 'team-1', 'team-2')).toBe(plan.roundCount);
      }
    });

    it('keeps seeds 1 and 4 apart until the semifinal', () => {
      for (const teamCount of [8, 16, 32, 64]) {
        const plan = build(teamCount, 4);
        expect(meetingRound(plan, 'team-1', 'team-4')).toBe(
          plan.roundCount - 1,
        );
      }
    });

    it('gives the byes to the seeded teams', () => {
      // 6 duplas, 2 sembradas: el cuadro es de 8 y sobran 2 lugares.
      const plan = build(6, 2);
      const byes = firstRound(plan).filter((match) => match.isBye);
      expect(byes).toHaveLength(2);
      expect(byes.map((match) => match.teamAId).sort()).toEqual([
        'team-1',
        'team-2',
      ]);
    });

    it('advances a bye winner into the next round when the plan is built', () => {
      const plan = build(6, 2);
      const semifinals = plan.matches.filter((match) => match.round === 2);
      const occupied = semifinals
        .flatMap((match) => [match.teamAId, match.teamBId])
        .filter((id): id is string => id !== null);

      // Las dos sembradas ya están puestas en semifinales; los otros dos
      // lugares esperan a los ganadores reales de la primera ronda.
      expect(occupied.sort()).toEqual(['team-1', 'team-2']);
    });

    it('does not treat a second-round match fed by a bye as a bye itself', () => {
      const plan = build(6, 2);
      for (const match of plan.matches.filter((m) => m.round >= 2)) {
        expect(match.isBye).toBe(false);
      }
    });
  });

  describe('the draw', () => {
    it('places seeded teams identically regardless of the shuffle', () => {
      const straight = build(12, 4, identityShuffle);
      const reversed = build(12, 4, reverseShuffle);

      const seedPositions = (plan: BracketPlan) =>
        firstRound(plan)
          .filter((match) => match.teamAId?.match(/^team-[1-4]$/))
          .map((match) => `${match.position}:${match.teamAId}`)
          .sort();

      // El azar mueve a las no sembradas; las cabezas no se mueven.
      expect(seedPositions(straight)).toEqual(seedPositions(reversed));
    });

    it('actually shuffles the unseeded teams', () => {
      const straight = build(8, 0, identityShuffle);
      const reversed = build(8, 0, reverseShuffle);

      const layout = (plan: BracketPlan) =>
        firstRound(plan).map((match) => `${match.teamAId}/${match.teamBId}`);

      expect(layout(straight)).not.toEqual(layout(reversed));
    });

    it('places every team exactly once no matter the shuffle', () => {
      const plan = build(11, 3, reverseShuffle);
      const placed = firstRound(plan)
        .flatMap((match) => [match.teamAId, match.teamBId])
        .filter((id): id is string => id !== null);
      expect(placed.sort()).toEqual(teamIds(11).sort());
    });
  });

  describe('rejects counts the service should have caught first', () => {
    it.each([0, 1, MAX_TEAMS + 1])('throws for %i teams', (teamCount) => {
      expect(() => build(teamCount)).toThrow(RangeError);
    });
  });

  describe('the degenerate bracket', () => {
    it('builds a single final for two teams', () => {
      const plan = build(2);
      expect(plan.matches).toHaveLength(1);
      expect(plan.roundCount).toBe(1);
      expect(plan.byeCount).toBe(0);
      expect(plan.matches[0]).toMatchObject({
        round: 1,
        position: 0,
        teamAId: 'team-1',
        teamBId: 'team-2',
        isBye: false,
        nextPosition: null,
        nextSlot: null,
      });
    });
  });
});

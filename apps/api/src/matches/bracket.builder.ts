import { randomInt } from 'node:crypto';

/**
 * Baraja una lista sin modificar la original. Se inyecta para que los tests
 * puedan fijar el orden: con sorteo de por medio, el generador ya no cumple
 * "mismo input, mismo output", así que lo que se testea son los invariantes
 * del cuadro y no una salida exacta.
 */
export type Shuffle = <T>(items: readonly T[]) => T[];

/**
 * Fisher-Yates con `randomInt` de `node:crypto` y no con `Math.random()`.
 * No es paranoia criptográfica: `Math.random()` obliga a escalar y redondear,
 * lo que sesga las posiciones cuando el rango no divide al espacio del
 * generador. Un sorteo sesgado es exactamente lo que un club no puede tener.
 */
export const cryptoShuffle: Shuffle = <T>(items: readonly T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/** Menor cantidad de duplas con la que se puede armar un cuadro. */
export const MIN_TEAMS = 2;

/** Techo técnico: 128 duplas son 256 jugadores y 127 partidos en una respuesta. */
export const MAX_TEAMS = 128;

export type PlannedSlot = 'a' | 'b';

export interface PlannedMatch {
  /** 1 es la primera ronda que se juega, no la final. */
  round: number;
  /** 0-based dentro de la ronda, de arriba hacia abajo. */
  position: number;
  teamAId: string | null;
  teamBId: string | null;
  /** Un bye ya nace cerrado: su ganador es `teamAId`. */
  isBye: boolean;
  /** `position` del partido siguiente, o `null` en la final. */
  nextPosition: number | null;
  nextSlot: PlannedSlot | null;
}

export interface BracketPlan {
  /** Potencia de 2 inmediatamente mayor o igual a la cantidad de duplas. */
  bracketSize: number;
  roundCount: number;
  byeCount: number;
  /** Ordenados por `(round asc, position asc)`. */
  matches: PlannedMatch[];
}

export interface BracketInput {
  /**
   * Duplas sembradas, **ya ordenadas por `seed` ascendente**. Que los seeds
   * sean `1..k` sin huecos lo valida el service contra la base; acá se asume.
   */
  seededTeamIds: readonly string[];
  /** Duplas sin sembrar. Estas son las que se sortean. */
  unseededTeamIds: readonly string[];
}

/**
 * Posiciones del cuadro en orden de siembra. Se construye duplicando: se
 * arranca con `[1]` y en cada paso cada entrada `s` se reemplaza por el par
 * `(s, 2n + 1 - s)`, donde `n` es el tamaño actual. Para 8 da
 * `[1, 8, 4, 5, 2, 7, 3, 6]`.
 *
 * Es lo que hace que un cuadro se sienta justo: la 1 y la 2 solo pueden
 * cruzarse en la final, y la 1 con la 4 recién en semifinales.
 *
 * Dos propiedades de las que depende el resto del archivo, y que salen de la
 * construcción y no de un chequeo aparte:
 *
 * 1. En cada par consecutivo, el primero es siempre el número más chico
 *    (porque `s <= n` y `2n + 1 - s >= n + 1`). Por eso el lado A del partido
 *    es siempre la mejor entrada, y el lado B el único que puede faltar.
 * 2. Los números altos —que son los que quedan vacíos cuando sobran lugares—
 *    caen enfrente de los bajos. Por eso los byes van a las sembradas sin una
 *    línea que los reparta.
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const paired = order.length * 2;
    const next: number[] = [];
    for (const entry of order) {
      next.push(entry, paired + 1 - entry);
    }
    order = next;
  }
  return order;
}

/** Potencia de 2 mínima que contiene a `teamCount`. */
export function bracketSizeFor(teamCount: number): number {
  let size = 1;
  while (size < teamCount) {
    size *= 2;
  }
  return size;
}

/**
 * Arma el plan del cuadro. **Función pura**: no toca Prisma ni la red, y el
 * único no-determinismo entra por `shuffle`, que se inyecta.
 *
 * El cuadro se llena en dos pasos, que es como se arma un torneo de verdad:
 * primero las sembradas van a sus posiciones protegidas, y recién después se
 * sortean las demás entre los lugares que quedaron.
 */
export function planBracket(
  input: BracketInput,
  shuffle: Shuffle = cryptoShuffle,
): BracketPlan {
  const teamCount = input.seededTeamIds.length + input.unseededTeamIds.length;

  // El service ya rechazó estos casos con un 409 que explica cuál es el
  // problema. Acá el throw es una red contra un llamador nuevo, no el camino
  // por el que un cliente recibe su error.
  if (teamCount < MIN_TEAMS || teamCount > MAX_TEAMS) {
    throw new RangeError(
      `a bracket needs between ${MIN_TEAMS} and ${MAX_TEAMS} teams, got ${teamCount}`,
    );
  }

  const bracketSize = bracketSizeFor(teamCount);
  const roundCount = Math.log2(bracketSize);
  const byeCount = bracketSize - teamCount;

  // `entrants[n]` es quién ocupa la entrada número `n` del cuadro (1-based).
  // Las sembradas toman las entradas bajas en orden de seed; las sorteadas
  // llenan el resto; y las entradas que sobran quedan `null`, que es lo que
  // produce los byes. Como `bracketSize` es la potencia *siguiente*, siempre
  // hay más duplas que la mitad del cuadro, así que los `null` nunca alcanzan
  // las entradas bajas: ningún bye cae en el lado A, y ningún bye se cruza
  // con otro bye.
  const entrants: (string | null)[] = new Array<string | null>(
    bracketSize + 1,
  ).fill(null);
  const drawn = shuffle(input.unseededTeamIds);
  const ordered = [...input.seededTeamIds, ...drawn];
  for (let i = 0; i < ordered.length; i += 1) {
    entrants[i + 1] = ordered[i];
  }

  const order = seedOrder(bracketSize);
  const matches: PlannedMatch[] = [];

  // Primera ronda: cada partido toma dos entradas consecutivas de la
  // secuencia de siembra.
  const firstRoundMatches = bracketSize / 2;
  for (let position = 0; position < firstRoundMatches; position += 1) {
    const teamAId = entrants[order[position * 2]];
    const teamBId = entrants[order[position * 2 + 1]];

    matches.push({
      round: 1,
      position,
      teamAId,
      teamBId,
      isBye: teamBId === null,
      ...advanceFrom(position, 1, roundCount),
    });
  }

  // Rondas siguientes: nacen vacías y ya enlazadas. Se materializan desde el
  // principio porque un `next_match_id` necesita que el destino exista, y
  // porque la vista pública dibuja el cuadro completo desde el minuto cero.
  for (let round = 2; round <= roundCount; round += 1) {
    const roundMatches = bracketSize / 2 ** round;
    for (let position = 0; position < roundMatches; position += 1) {
      matches.push({
        round,
        position,
        teamAId: null,
        teamBId: null,
        isBye: false,
        ...advanceFrom(position, round, roundCount),
      });
    }
  }

  // Propagación de los byes, en memoria: el ganador de un bye ya se escribe en
  // su lugar de la segunda ronda, así que el cuadro nace consistente y el
  // avance tiene un solo camino en vez de dos.
  //
  // Es de un solo nivel a propósito: un partido de ronda 2 con un solo lado
  // ocupado por un bye **no** es un bye — espera al ganador real del otro
  // alimentador. Cuando sus dos alimentadores son byes, es un partido real
  // entre dos sembradas.
  const byRound = (round: number, position: number): PlannedMatch | undefined =>
    matches.find(
      (match) => match.round === round && match.position === position,
    );

  for (const match of matches) {
    if (match.round !== 1 || !match.isBye || match.nextPosition === null) {
      continue;
    }
    const next = byRound(2, match.nextPosition);
    if (!next) {
      continue;
    }
    if (match.nextSlot === 'a') {
      next.teamAId = match.teamAId;
    } else {
      next.teamBId = match.teamAId;
    }
  }

  return { bracketSize, roundCount, byeCount, matches };
}

/**
 * A dónde avanza el ganador del partido `(round, position)`. Dos partidos
 * hermanos alimentan el mismo destino, y el par —el de posición par al lado A,
 * el impar al lado B— es lo que hace que la propagación sea determinista y no
 * una carrera por el slot libre.
 */
function advanceFrom(
  position: number,
  round: number,
  roundCount: number,
): Pick<PlannedMatch, 'nextPosition' | 'nextSlot'> {
  if (round === roundCount) {
    return { nextPosition: null, nextSlot: null };
  }
  return {
    nextPosition: Math.floor(position / 2),
    nextSlot: position % 2 === 0 ? 'a' : 'b',
  };
}

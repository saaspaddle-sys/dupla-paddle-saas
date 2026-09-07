import { Prisma } from '../../generated/prisma/client';
import {
  uniqueViolationMentions,
  uniqueViolationTargets,
} from './unique-violation';

function knownError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: 'test',
    meta,
  });
}

/**
 * La forma **real** que produce `@prisma/adapter-pg` en Prisma 7, copiada de
 * un P2002 capturado contra Postgres. Es el caso que importa: no hay `target`
 * por ningún lado, y un chequeo escrito contra `meta.target` devolvería vacío
 * y convertiría el 409 en un 500.
 */
function adapterViolation(
  constraint: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return knownError('P2002', {
    modelName: 'Team',
    driverAdapterError: {
      name: 'DriverAdapterError',
      cause: {
        originalCode: '23505',
        originalMessage: 'duplicate key value violates unique constraint',
        kind: 'UniqueConstraintViolation',
        constraint,
      },
    },
  });
}

describe('uniqueViolationTargets', () => {
  it('reads the column list the pg driver adapter reports', () => {
    const error = adapterViolation({ fields: ['tournament_id', 'seed'] });

    expect(uniqueViolationTargets(error)).toEqual(['tournament_id', 'seed']);
  });

  it('falls back to the index name when the adapter could not resolve columns', () => {
    const error = adapterViolation({ index: 'teams_tournament_id_seed_key' });

    expect(uniqueViolationTargets(error)).toEqual([
      'teams_tournament_id_seed_key',
    ]);
  });

  // La forma clásica del motor. Se sigue leyendo para no romper los tests que
  // mockean el error a mano ni un futuro cambio de vuelta.
  it('still reads meta.target, both as an array and as a bare string', () => {
    expect(
      uniqueViolationTargets(knownError('P2002', { target: ['seed'] })),
    ).toEqual(['seed']);
    expect(
      uniqueViolationTargets(
        knownError('P2002', { target: 'teams_tournament_id_seed_key' }),
      ),
    ).toEqual(['teams_tournament_id_seed_key']);
  });

  it('lowercases everything so the caller can compare without thinking about it', () => {
    const error = knownError('P2002', { target: ['Seed', 'TournamentId'] });

    expect(uniqueViolationTargets(error)).toEqual(['seed', 'tournamentid']);
  });

  it.each([
    ['a different Prisma code', knownError('P2025')],
    ['a P2002 with no meta at all', knownError('P2002')],
    ['a plain Error', new Error('boom')],
    ['a non-error value', 'P2002'],
  ])('returns nothing for %s', (_label, error) => {
    expect(uniqueViolationTargets(error)).toEqual([]);
  });
});

describe('uniqueViolationMentions', () => {
  it('matches a fragment against the adapter column list', () => {
    const error = adapterViolation({ fields: ['tournament_id', 'seed'] });

    expect(uniqueViolationMentions(error, 'seed')).toBe(true);
    expect(uniqueViolationMentions(error, 'player1')).toBe(false);
  });

  it('matches a fragment inside a constraint name', () => {
    const error = adapterViolation({
      index: 'teams_tournament_id_player1_id_player2_id_key',
    });

    expect(uniqueViolationMentions(error, 'player1')).toBe(true);
  });

  it('is true when any of several fragments matches', () => {
    const error = adapterViolation({ fields: ['slug'] });

    expect(uniqueViolationMentions(error, 'email', 'slug')).toBe(true);
  });

  it('is false for anything that is not a unique violation', () => {
    expect(uniqueViolationMentions(new Error('boom'), 'seed')).toBe(false);
  });
});

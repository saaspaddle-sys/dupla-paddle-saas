import { TournamentModel } from '../generated/prisma/models';
import { toTournamentResponse } from './tournaments.mapper';

function createTournament(
  overrides: Partial<TournamentModel> = {},
): TournamentModel {
  return {
    id: 'tournament-1',
    clubId: 'club-1',
    name: 'Apertura 2026',
    format: 'single_elimination',
    status: 'open',
    createdAt: new Date('2026-08-24T12:00:00.000Z'),
    updatedAt: new Date('2026-08-24T12:05:00.000Z'),
    ...overrides,
  };
}

describe('toTournamentResponse', () => {
  it('maps a tournament into the contracted response shape', () => {
    const response = toTournamentResponse(createTournament());

    expect(response).toEqual({
      id: 'tournament-1',
      name: 'Apertura 2026',
      format: 'single_elimination',
      status: 'open',
      createdAt: '2026-08-24T12:00:00.000Z',
      updatedAt: '2026-08-24T12:05:00.000Z',
    });
  });

  // La razón por la que este mapper es manual: `clubId` es justamente el
  // campo que un club no tiene que poder ver de otro, y en la clase `club`
  // ni siquiera necesita verlo del suyo (invariante de tenancy).
  it('never leaks the clubId', () => {
    const response = toTournamentResponse(createTournament());

    expect(response).not.toHaveProperty('clubId');
    expect(JSON.stringify(response)).not.toContain('club-1');
  });

  it('serializes timestamps as ISO 8601 strings', () => {
    const response = toTournamentResponse(createTournament());

    expect(typeof response.createdAt).toBe('string');
    expect(typeof response.updatedAt).toBe('string');
  });
});

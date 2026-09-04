import {
  TeamPlayerSource,
  TeamWithPlayers,
  toTeamResponse,
} from './teams.mapper';

function createTeam(overrides: Partial<TeamWithPlayers> = {}): TeamWithPlayers {
  return {
    id: 'team-1',
    clubId: 'club-1',
    tournamentId: 'tournament-1',
    player1Id: 'player-1',
    player2Id: 'player-2',
    createdAt: new Date('2026-08-24T12:00:00.000Z'),
    updatedAt: new Date('2026-08-24T12:00:00.000Z'),
    player1: {
      id: 'player-1',
      firstName: 'Juan',
      lastName: 'Pérez',
      category: 'C4',
    },
    player2: {
      id: 'player-2',
      firstName: 'Ana',
      lastName: 'Gómez',
      category: null,
    },
    ...overrides,
  };
}

describe('toTeamResponse', () => {
  it('maps the team and both players into the contracted response shape', () => {
    const response = toTeamResponse(createTeam());

    expect(response).toEqual({
      id: 'team-1',
      tournamentId: 'tournament-1',
      player1: {
        id: 'player-1',
        firstName: 'Juan',
        lastName: 'Pérez',
        category: 'C4',
      },
      player2: {
        id: 'player-2',
        firstName: 'Ana',
        lastName: 'Gómez',
        category: null,
      },
      createdAt: '2026-08-24T12:00:00.000Z',
    });
  });

  // Ley 25.326, regla dura y sin excepciones: el dni de ningún jugador de la
  // dupla puede salir por acá, ni siquiera si algún día un `include` de más
  // lo trae en la fila fuente. El mapper es manual campo por campo
  // justamente para que esto sea así aunque cambie el `select` de la query.
  it('never leaks either player dni, even if the source row happens to carry one', () => {
    const withDni = createTeam({
      player1: {
        id: 'player-1',
        firstName: 'Juan',
        lastName: 'Pérez',
        category: 'C4',
        dni: '12345678',
      } as unknown as TeamPlayerSource,
    });

    const response = toTeamResponse(withDni);

    expect(response.player1).not.toHaveProperty('dni');
    expect(JSON.stringify(response)).not.toContain('12345678');
  });

  it('never leaks the clubId', () => {
    const response = toTeamResponse(createTeam());

    expect(response).not.toHaveProperty('clubId');
  });

  it('never leaks the updatedAt timestamp', () => {
    const response = toTeamResponse(createTeam());

    expect(response).not.toHaveProperty('updatedAt');
  });
});

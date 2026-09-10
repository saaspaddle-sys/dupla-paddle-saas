import { PrismaService } from '../prisma/prisma.service';
import { MatchesService } from './matches.service';

type PrismaMock = {
  $transaction: jest.Mock;
  match: { findFirst: jest.Mock; updateMany: jest.Mock };
  matchSet: { deleteMany: jest.Mock; createMany: jest.Mock };
  tournament: { updateMany: jest.Mock };
};

const MATCH = {
  id: 'match-1',
  clubId: 'club-1',
  tournamentId: 'tournament-1',
  round: 1,
  teamAId: 'team-a',
  teamBId: 'team-b',
  status: 'pending',
  nextMatchId: 'match-2',
  nextSlot: 'a',
  tournament: { status: 'in_progress', format: 'single_elimination' },
};

describe('MatchesService', () => {
  let service: MatchesService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((handler: (tx: unknown) => unknown) =>
        handler(prisma),
      ),
      match: {
        findFirst: jest.fn().mockResolvedValue(MATCH),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      matchSet: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      tournament: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    service = new MatchesService(prisma as unknown as PrismaService);
  });

  it('records a normal result, persists sets, and advances the winner in its assigned slot', async () => {
    const result = await service.recordResult('club-1', 'match-1', {
      outcome: 'normal',
      winnerTeamId: 'team-a',
      sets: [
        { kind: 'standard', teamAGames: 6, teamBGames: 4 },
        { kind: 'standard', teamAGames: 6, teamBGames: 2 },
      ],
    });

    expect(result).toMatchObject({
      status: 'finished',
      winnerTeamId: 'team-a',
    });
    expect(prisma.match.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'match-1', clubId: 'club-1', status: 'pending' },
      data: { status: 'finished', outcome: 'normal', winnerTeamId: 'team-a' },
    });
    expect(prisma.match.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'match-2', clubId: 'club-1', teamAId: null },
      data: { teamAId: 'team-a' },
    });
    const calls = prisma.matchSet.createMany.mock.calls as unknown[][];
    const inserted = calls[0][0] as {
      data: { setNumber: number; clubId: string }[];
    };
    expect(inserted.data).toHaveLength(2);
    expect(inserted.data[0]).toMatchObject({
      setNumber: 1,
      clubId: 'club-1',
    });
  });

  it('records and advances team B when it wins two sets', async () => {
    const result = await service.recordResult('club-1', 'match-1', {
      outcome: 'normal',
      winnerTeamId: 'team-b',
      sets: [
        { kind: 'standard', teamAGames: 4, teamBGames: 6 },
        { kind: 'standard', teamAGames: 2, teamBGames: 6 },
      ],
    });
    expect(result.winnerTeamId).toBe('team-b');
    expect(prisma.match.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'match-2', clubId: 'club-1', teamAId: null },
      data: { teamAId: 'team-b' },
    });
  });

  it('finishes the tournament after the single-elimination final', async () => {
    prisma.match.findFirst.mockResolvedValue({
      ...MATCH,
      nextMatchId: null,
      nextSlot: null,
      round: 2,
    });
    await service.recordResult('club-1', 'match-1', {
      outcome: 'walkover',
      winnerTeamId: 'team-a',
    });
    expect(prisma.tournament.updateMany).toHaveBeenCalledWith({
      where: { id: 'tournament-1', clubId: 'club-1', status: 'in_progress' },
      data: { status: 'finished' },
    });
  });

  it('hides a match outside the club scope', async () => {
    prisma.match.findFirst.mockResolvedValue(null);
    await expect(
      service.recordResult('club-1', 'other-match', {
        outcome: 'walkover',
        winnerTeamId: 'team-a',
      }),
    ).rejects.toMatchObject({ response: { code: 'match_not_found' } });
    expect(prisma.match.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a result for an unfinished future match', async () => {
    prisma.match.findFirst.mockResolvedValue({ ...MATCH, teamBId: null });
    await expect(
      service.recordResult('club-1', 'match-1', {
        outcome: 'walkover',
        winnerTeamId: 'team-a',
      }),
    ).rejects.toMatchObject({ response: { code: 'match_not_ready' } });
  });

  it('rejects a duplicate concurrent result through the conditional update', async () => {
    prisma.match.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.recordResult('club-1', 'match-1', {
        outcome: 'walkover',
        winnerTeamId: 'team-a',
      }),
    ).rejects.toMatchObject({ response: { code: 'match_already_finished' } });
    expect(prisma.matchSet.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a normal score that does not produce two won sets', async () => {
    await expect(
      service.recordResult('club-1', 'match-1', {
        outcome: 'normal',
        winnerTeamId: 'team-a',
        sets: [{ kind: 'standard', teamAGames: 6, teamBGames: 4 }],
      }),
    ).rejects.toMatchObject({ response: { code: 'invalid_match_result' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a winner that disagrees with the recorded scores', async () => {
    await expect(
      service.recordResult('club-1', 'match-1', {
        outcome: 'normal',
        winnerTeamId: 'team-b',
        sets: [
          { kind: 'standard', teamAGames: 6, teamBGames: 4 },
          { kind: 'standard', teamAGames: 6, teamBGames: 2 },
        ],
      }),
    ).rejects.toMatchObject({ response: { code: 'invalid_match_result' } });
    expect(prisma.match.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a 7-6 set whose tiebreak is won by the other team', async () => {
    await expect(
      service.recordResult('club-1', 'match-1', {
        outcome: 'normal',
        winnerTeamId: 'team-a',
        sets: [
          {
            kind: 'standard',
            teamAGames: 7,
            teamBGames: 6,
            teamATiebreak: 5,
            teamBTiebreak: 7,
          },
          { kind: 'standard', teamAGames: 6, teamBGames: 2 },
        ],
      }),
    ).rejects.toMatchObject({ response: { code: 'invalid_match_result' } });
  });

  it('rejects a third set after a team has won the first two', async () => {
    await expect(
      service.recordResult('club-1', 'match-1', {
        outcome: 'normal',
        winnerTeamId: 'team-a',
        sets: [
          { kind: 'standard', teamAGames: 6, teamBGames: 4 },
          { kind: 'standard', teamAGames: 6, teamBGames: 2 },
          { kind: 'super_tiebreak', teamATiebreak: 10, teamBTiebreak: 8 },
        ],
      }),
    ).rejects.toMatchObject({ response: { code: 'invalid_match_result' } });
  });
});

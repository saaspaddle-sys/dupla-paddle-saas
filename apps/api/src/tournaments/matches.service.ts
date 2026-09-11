import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { runSerializable } from '../common/prisma/serializable';
import { PrismaService } from '../prisma/prisma.service';
import { MatchParamsDto } from './dto/match-params.dto';
import {
  MatchSetScoreDto,
  RecordMatchResultDto,
} from './dto/record-match-result.dto';
import { MatchResultResponseDto } from './dto/match-result-response.dto';

function matchNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'match_not_found',
    message: 'the match does not exist',
  });
}

function matchNotReady(): ConflictException {
  return new ConflictException({
    code: 'match_not_ready',
    message: 'the match needs two teams before recording a result',
  });
}

function matchAlreadyFinished(): ConflictException {
  return new ConflictException({
    code: 'match_already_finished',
    message: 'the match already has a recorded result',
  });
}

function invalidResult(message: string): ConflictException {
  return new ConflictException({ code: 'invalid_match_result', message });
}

function invalidTournamentState(): ConflictException {
  return new ConflictException({
    code: 'tournament_not_in_progress',
    message: 'the tournament is not in progress',
  });
}

function winningSide(set: MatchSetScoreDto): 'a' | 'b' | null {
  const a = set.kind === 'standard' ? set.teamAGames : set.teamATiebreak;
  const b = set.kind === 'standard' ? set.teamBGames : set.teamBTiebreak;
  if (a === undefined || b === undefined || a === b) return null;
  return a > b ? 'a' : 'b';
}

function validTiebreak(a: number | undefined, b: number | undefined): boolean {
  return (
    a !== undefined &&
    b !== undefined &&
    Math.max(a, b) >= 7 &&
    Math.abs(a - b) >= 2
  );
}

function validStandardSet(set: MatchSetScoreDto): boolean {
  const a = set.teamAGames;
  const b = set.teamBGames;
  if (a === undefined || b === undefined) return false;
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);
  const tiebreakPresent =
    set.teamATiebreak !== undefined || set.teamBTiebreak !== undefined;
  if (winner === 6 && loser <= 4) return !tiebreakPresent;
  if (winner === 7 && loser === 5) return !tiebreakPresent;
  if (winner === 7 && loser === 6) {
    return (
      validTiebreak(set.teamATiebreak, set.teamBTiebreak) &&
      winningSide(set) === (set.teamATiebreak! > set.teamBTiebreak! ? 'a' : 'b')
    );
  }
  return false;
}

function validSuperTiebreak(set: MatchSetScoreDto): boolean {
  const a = set.teamATiebreak;
  const b = set.teamBTiebreak;
  return (
    set.teamAGames === undefined &&
    set.teamBGames === undefined &&
    a !== undefined &&
    b !== undefined &&
    Math.max(a, b) >= 10 &&
    Math.abs(a - b) >= 2
  );
}

function validateSets(dto: RecordMatchResultDto): void {
  if (dto.outcome === 'walkover' && dto.sets?.length) {
    throw invalidResult('a walkover cannot include sets');
  }
  if (dto.outcome === 'normal' && !dto.sets?.length) {
    throw invalidResult('a normal result needs recorded sets');
  }
  if (!dto.sets) return;

  const wins = { a: 0, b: 0 };
  dto.sets.forEach((set, index) => {
    if (dto.outcome === 'normal' && Math.max(wins.a, wins.b) === 2) {
      throw invalidResult(
        'a normal result cannot include sets after it is decided',
      );
    }
    if (
      set.kind === 'standard'
        ? !validStandardSet(set)
        : !validSuperTiebreak(set)
    ) {
      throw invalidResult(`set ${index + 1} has an invalid score`);
    }
    if (set.kind === 'super_tiebreak' && index !== 2) {
      throw invalidResult('a super tiebreak can only be the third set');
    }
    const side = winningSide(set);
    if (side) wins[side] += 1;
  });

  if (dto.outcome !== 'normal') return;
  if (Math.max(wins.a, wins.b) !== 2) {
    throw invalidResult('a normal result needs a team to win two sets');
  }
}

function validateNormalWinner(
  dto: RecordMatchResultDto,
  teamAId: string,
  teamBId: string,
): void {
  if (dto.outcome !== 'normal' || !dto.sets) return;
  const wins = dto.sets.reduce(
    (total, set) => {
      const side = winningSide(set);
      return side === null ? total : { ...total, [side]: total[side] + 1 };
    },
    { a: 0, b: 0 },
  );
  const scoreWinner = wins.a > wins.b ? teamAId : teamBId;
  if (scoreWinner !== dto.winnerTeamId) {
    throw invalidResult('winnerTeamId must match the recorded set scores');
  }
}

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async recordResult(
    clubId: string,
    matchId: MatchParamsDto['matchId'],
    dto: RecordMatchResultDto,
  ): Promise<MatchResultResponseDto> {
    validateSets(dto);

    return runSerializable(this.prisma, async (tx) => {
      const match = await tx.match.findFirst({
        where: { id: matchId, clubId },
        select: {
          id: true,
          clubId: true,
          tournamentId: true,
          round: true,
          teamAId: true,
          teamBId: true,
          status: true,
          nextMatchId: true,
          nextSlot: true,
          tournament: { select: { status: true, format: true } },
        },
      });
      if (!match) throw matchNotFound();
      if (match.tournament.status !== 'in_progress')
        throw invalidTournamentState();
      if (match.status !== 'pending') throw matchAlreadyFinished();
      if (!match.teamAId || !match.teamBId) throw matchNotReady();
      if (
        dto.winnerTeamId !== match.teamAId &&
        dto.winnerTeamId !== match.teamBId
      ) {
        throw invalidResult('winnerTeamId must identify a team in the match');
      }
      validateNormalWinner(dto, match.teamAId, match.teamBId);

      const claimed = await tx.match.updateMany({
        where: { id: match.id, clubId, status: 'pending' },
        data: {
          status: 'finished',
          outcome: dto.outcome,
          winnerTeamId: dto.winnerTeamId,
        },
      });
      if (claimed.count === 0) throw matchAlreadyFinished();

      await tx.matchSet.deleteMany({ where: { matchId: match.id, clubId } });
      if (dto.sets?.length) {
        await tx.matchSet.createMany({
          data: dto.sets.map((set, index) => ({
            clubId,
            matchId: match.id,
            setNumber: index + 1,
            kind: set.kind,
            teamAGames: set.teamAGames ?? null,
            teamBGames: set.teamBGames ?? null,
            teamATiebreak: set.teamATiebreak ?? null,
            teamBTiebreak: set.teamBTiebreak ?? null,
          })),
        });
      }

      if (match.nextMatchId && match.nextSlot) {
        const nextSlot = match.nextSlot === 'a' ? 'teamAId' : 'teamBId';
        const advanced = await tx.match.updateMany({
          where: { id: match.nextMatchId, clubId, [nextSlot]: null },
          data: { [nextSlot]: dto.winnerTeamId },
        });
        if (advanced.count === 0) {
          throw new ConflictException({
            code: 'next_match_slot_occupied',
            message: 'the next match slot is already occupied',
          });
        }
      } else if (match.tournament.format === 'single_elimination') {
        // Este slice solo tiene eliminación directa: un partido sin avance de
        // este formato es la final. Cuando exista fase de zonas, la condición
        // debe sumar `phase === knockout`, no reutilizar este camino.
        await tx.tournament.updateMany({
          where: { id: match.tournamentId, clubId, status: 'in_progress' },
          data: { status: 'finished' },
        });
      }

      return {
        id: match.id,
        status: 'finished',
        outcome: dto.outcome,
        winnerTeamId: dto.winnerTeamId,
        sets: dto.sets ?? [],
      };
    });
  }
}

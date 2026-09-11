import { ApiProperty } from '@nestjs/swagger';
import { MatchOutcome, MatchStatus } from '../../generated/prisma/enums';
import { MatchSetScoreDto } from './record-match-result.dto';

export class MatchResultResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: MatchStatus })
  status!: MatchStatus;

  @ApiProperty({ enum: MatchOutcome })
  outcome!: MatchOutcome;

  @ApiProperty({ format: 'uuid' })
  winnerTeamId!: string;

  @ApiProperty({ type: MatchSetScoreDto, isArray: true })
  sets!: MatchSetScoreDto[];
}

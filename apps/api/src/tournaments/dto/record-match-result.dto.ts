import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { normalizeUuidInput } from '../../common/transforms/normalize';
import { MatchOutcome, MatchSetKind } from '../../generated/prisma/enums';

const RECORDABLE_OUTCOMES = ['normal', 'walkover', 'retirement'] as const;

export class MatchSetScoreDto {
  @IsEnum(MatchSetKind)
  kind!: MatchSetKind;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  teamAGames?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  teamBGames?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  teamATiebreak?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  teamBTiebreak?: number;
}

/** El resultado lo escribe el club; `bye` queda reservado al generador. */
export class RecordMatchResultDto {
  @ApiProperty({ enum: RECORDABLE_OUTCOMES })
  @IsEnum(RECORDABLE_OUTCOMES)
  outcome!: Exclude<MatchOutcome, 'bye'>;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }: { value: unknown }) => normalizeUuidInput(value))
  @IsUUID('all', { message: 'winnerTeamId must be a valid team id' })
  winnerTeamId!: string;

  @ApiPropertyOptional({ type: MatchSetScoreDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => MatchSetScoreDto)
  sets?: MatchSetScoreDto[];
}

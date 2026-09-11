import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MatchParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'matchId must be a valid id' })
  matchId!: string;
}

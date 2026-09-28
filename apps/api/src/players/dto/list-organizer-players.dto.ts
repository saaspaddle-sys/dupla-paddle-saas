import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  normalizeTextInput,
  normalizeUuidInput,
} from '../../common/transforms/normalize';

export const ORGANIZER_PLAYERS_PAGE_SIZE_DEFAULT = 20;
export const ORGANIZER_PLAYERS_PAGE_SIZE_MAX = 100;

/** Búsqueda autenticada del organizador sobre el directorio global no acotado. */
export class ListOrganizerPlayersDto {
  @Transform(({ value }: { value: unknown }) => normalizeTextInput(value))
  @IsString({ message: 'q must be a string' })
  @MinLength(2, { message: 'q must be at least 2 characters' })
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(ORGANIZER_PLAYERS_PAGE_SIZE_MAX, {
    message: `limit must be at most ${ORGANIZER_PLAYERS_PAGE_SIZE_MAX}`,
  })
  limit?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeUuidInput(value))
  @IsUUID('all', { message: 'cursor must be a valid player id' })
  cursor?: string;
}

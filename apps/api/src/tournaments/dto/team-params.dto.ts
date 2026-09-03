import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Params de las rutas que apuntan a una dupla concreta. No extiende
 * `TournamentParamsDto`: el `ValidationPipe` global corre con
 * `forbidNonWhitelisted`, así que un DTO con un campo de más rechazaría las
 * rutas que solo traen `tournamentId`. Dos clases planas y explícitas cuesta
 * cuatro líneas y no tiene ese modo de falla.
 */
export class TeamParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'tournamentId must be a valid id' })
  tournamentId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'teamId must be a valid id' })
  teamId!: string;
}

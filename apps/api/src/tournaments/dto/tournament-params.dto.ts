import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Params de las rutas que cuelgan de un torneo. Existe como DTO y no como
 * `@Param('tournamentId')` pelado porque todo lo que entra por un controller
 * pasa por class-validator (`docs/api-conventions.md`): sin esto, un
 * `:tournamentId` que no sea UUID llega a Prisma y vuelve como 500 en vez de
 * como `400 validation`.
 */
export class TournamentParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'tournamentId must be a valid id' })
  tournamentId!: string;
}

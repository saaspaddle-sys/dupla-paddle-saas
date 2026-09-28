import { PlayerGender } from '../../generated/prisma/enums';

/**
 * Proyección deliberada, sin contacto, para organizadores. Un Player global
 * no pertenece al club, pero el staff puede encontrarlo e inscribirlo en un
 * torneo propio.
 */
export class OrganizerPlayerResponseDto {
  id!: string;
  firstName!: string;
  lastName!: string;
  category!: string | null;
  gender!: PlayerGender | null;
  createdAt!: string;
}

export class OrganizerPlayerListResponseDto {
  items!: OrganizerPlayerResponseDto[];
  nextCursor!: string | null;
}

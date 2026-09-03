import {
  TournamentFormat,
  TournamentStatus,
} from '../../generated/prisma/enums';

/**
 * Una sola forma para los cuatro endpoints de torneo, que el frontend tipa
 * una vez.
 *
 * **Nunca sale `clubId`**: en la clase `club` el tenant es implícito —el
 * cliente ya sabe de qué club es porque es el suyo— y devolverlo solo
 * serviría para que alguien lo mande de vuelta en un request, que es
 * exactamente lo que el invariante de tenancy prohíbe. Mismo criterio que
 * `ClubResponseDto`, que no expone `ownerId`.
 *
 * Nota de forward-compat para el consumidor: `status` y `format` son enums
 * que van a ganar valores (`format` hoy tiene uno solo). Un valor
 * desconocido se trata como desconocido y no rompe — agregar un valor a un
 * enum de respuesta es un cambio permitido en el lugar, y va a pasar.
 */
export class TournamentResponseDto {
  /** Es el `tournamentId` de las rutas anidadas. */
  id!: string;
  name!: string;
  format!: TournamentFormat;
  status!: TournamentStatus;
  /** ISO 8601. */
  createdAt!: string;
  /** ISO 8601. */
  updatedAt!: string;
}

import {
  ClubStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../generated/prisma/enums';

/**
 * Sin `id` ni ningún campo administrativo de billing (notas, quién activó,
 * fechas de cobro): no hay consumidor y no se agrega "por si acaso".
 */
export class ClubSubscriptionDto {
  /** Toda suscripción nace en `basic`; el cambio de plan es manual. */
  plan!: SubscriptionPlan;

  /** Arranca en `pending`: el cobro es manual y se activa a mano. */
  status!: SubscriptionStatus;

  /**
   * Cuota del plan: 3 en `basic`, 12 en `pro`. Cuenta llaves **activas
   * simultáneas**, no acumuladas ni por período. La consume el slice de
   * torneos; este slice solo la guarda.
   */
  maxTournaments!: number;
}

/**
 * Una sola forma para los tres endpoints, que el frontend tipa una vez.
 *
 * Nunca sale `ownerId` ni ningún dato del `User` dueño: el cliente ya
 * conoce su propia identidad por `/auth/me`, y exponer el `owner_id` en una
 * representación de club solo puede servir para correlacionar cuentas
 * ajenas el día que exista una vista pública.
 *
 * Nota de forward-compat para el consumidor: `status` y `plan` son enums
 * que van a ganar valores. Un valor desconocido se trata como desconocido y
 * no rompe — agregar un valor a un enum de respuesta es un cambio permitido
 * en el lugar, y va a pasar.
 */
export class ClubResponseDto {
  /** Es el `club_id`, pero el cliente nunca lo manda de vuelta. */
  id!: string;
  name!: string;
  slug!: string;
  status!: ClubStatus;
  /** ISO 8601. */
  createdAt!: string;
  /** ISO 8601. */
  updatedAt!: string;

  /**
   * **No** es nullable: todo club nace con su suscripción en la misma
   * transacción. Ver `ClubsService` para qué pasa si esa invariante se
   * rompe (spoiler: 500, no `subscription: null`).
   */
  subscription!: ClubSubscriptionDto;
}

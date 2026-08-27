import { ClubStatus, PlayerGender } from '../../generated/prisma/enums';

export class CurrentUserPlayerDto {
  id!: string;
  firstName!: string;
  lastName!: string;
  category!: string | null;
  gender!: PlayerGender | null;
}

/**
 * Sin `subscription` a propósito: `/auth/me` es identidad y lo llama el
 * bootstrap de sesión; el estado de cobro es del panel, y el panel arranca
 * con `GET /clubs/me`, que sí la trae.
 */
export class CurrentUserClubDto {
  id!: string;
  name!: string;
  slug!: string;
  status!: ClubStatus;
}

/**
 * Igual que `RegisterPlayerResponseDto` (`players/dto/register-player-response.dto.ts`),
 * nunca `dni` ni `passwordHash` — regla dura sin excepción, ni siquiera
 * tratándose de los propios datos de quien pide `/auth/me` (Ley 25.326).
 *
 * `player: null` es la señal que usa el frontend para saber que esta
 * cuenta no tiene perfil de jugador vinculado, y `club: null` su
 * contraparte de organizador: con eso alcanza para saber si la cuenta
 * administra un club sin pegarle a `/clubs/me` y comerse un 403 como flujo
 * normal.
 *
 * Los cuatro campos de `club` viajan también en `ClubResponseDto`. Es
 * duplicación deliberada: evita un segundo request en el bootstrap de
 * sesión, y `/clubs/me` sigue siendo la representación completa.
 */
export class CurrentUserResponseDto {
  id!: string;
  email!: string;
  player!: CurrentUserPlayerDto | null;
  club!: CurrentUserClubDto | null;
}

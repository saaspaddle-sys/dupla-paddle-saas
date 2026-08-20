import { PlayerGender } from '../../generated/prisma/enums';

export class CurrentUserPlayerDto {
  id!: string;
  firstName!: string;
  lastName!: string;
  category!: string | null;
  gender!: PlayerGender | null;
}

/**
 * Igual que `RegisterPlayerResponseDto` (`players/dto/register-player-response.dto.ts`),
 * nunca `dni` ni `passwordHash` — regla dura sin excepción, ni siquiera
 * tratándose de los propios datos de quien pide `/auth/me` (Ley 25.326).
 *
 * `player: null` es la señal que usa el frontend para saber que esta
 * cuenta no tiene perfil de jugador vinculado. La contraparte de
 * organizador (`club`) se suma en el slice de tenant.
 */
export class CurrentUserResponseDto {
  id!: string;
  email!: string;
  player!: CurrentUserPlayerDto | null;
}

import { OmitType } from '@nestjs/swagger';
import { RegisterPlayerDto } from './register-player.dto';

/**
 * El staff del club crea solo el perfil global, nunca credenciales. El email
 * es obligatorio porque un claim futuro debe verificar control de esta
 * dirección ya almacenada.
 */
export class CreateOrganizerPlayerDto extends OmitType(RegisterPlayerDto, [
  'password',
] as const) {}

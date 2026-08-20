import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import { normalizeEmailInput } from '../../common/transforms/normalize';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) => normalizeEmailInput(value))
  @IsEmail({}, { message: 'email must be a valid address' })
  @MaxLength(254, { message: 'email must be at most 254 characters' })
  email!: string;

  // A propósito, sin `@MinLength` ni `@NoBcryptTruncation` (a diferencia de
  // `RegisterPlayerDto`): validar el *formato* de una contraseña en el
  // login es inútil para credenciales ya existentes y regala información
  // sobre por qué falló. `@MaxLength(72)` sigue siendo necesario: sin tope,
  // un string enorme se manda entero a bcrypt y paga su costo de CPU igual.
  @IsString({ message: 'password is required' })
  @MaxLength(72, { message: 'password must be at most 72 characters' })
  password!: string;
}

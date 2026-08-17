import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NoBcryptTruncation } from '../../common/validators/no-bcrypt-truncation.validator';
import {
  normalizeCountryInput,
  normalizeDniInput,
  normalizeEmailInput,
  normalizeNameInput,
  normalizePhoneInput,
  normalizeTextInput,
} from '../../common/transforms/normalize';
import { IsValidBirthDate } from '../../common/validators/is-valid-birth-date.validator';
import { PlayerGender, PlayerHand } from '../../generated/prisma/enums';

// Acentos/ñ (\p{L}\p{M}), apóstrofo, punto, guion y espacio.
const NAME_REGEX = /^[\p{L}\p{M}'.\- ]+$/u;

// E.164: `+`, código de país que no arranca en 0, y entre 8 y 15 dígitos
// en total. Es el formato que ya guardamos normalizado, no el que se
// tipea — el @Transform saca espacios, guiones y paréntesis antes.
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export class RegisterPlayerDto {
  @Transform(({ value }: { value: unknown }) => normalizeEmailInput(value))
  @IsEmail({}, { message: 'email must be a valid address' })
  @MaxLength(254, { message: 'email must be at most 254 characters' })
  email!: string;

  // Sin trim (trimear contraseñas es un bug) y sin requisitos de
  // complejidad: el vector real es credential stuffing, se ataca con rate
  // limit en el módulo de login, no con reglas de formato acá.
  @IsString({ message: 'password is required' })
  @MinLength(8, { message: 'password must be at least 8 characters' })
  // Tope de UX rápido en caracteres. La garantía real (bcrypt trunca en
  // silencio más allá de 72 *bytes* UTF-8, no caracteres) la da
  // @NoBcryptTruncation de abajo — un password de 72 caracteres acentuados
  // ya son más de 72 bytes y este @MaxLength solo no lo atraparía.
  @MaxLength(72, {
    message: 'password must be at most 72 characters',
  })
  @NoBcryptTruncation()
  password!: string;

  @Transform(({ value }: { value: unknown }) => normalizeDniInput(value))
  @IsString({ message: 'dni is required' })
  @Matches(/^\d{7,8}$/, { message: 'dni must have 7 or 8 digits' })
  dni!: string;

  @Transform(({ value }: { value: unknown }) => normalizeNameInput(value))
  @IsString({ message: 'firstName is required' })
  @MinLength(2, { message: 'firstName must be at least 2 characters' })
  @MaxLength(60, { message: 'firstName must be at most 60 characters' })
  @Matches(NAME_REGEX, {
    message: 'firstName contains characters that are not allowed',
  })
  firstName!: string;

  @Transform(({ value }: { value: unknown }) => normalizeNameInput(value))
  @IsString({ message: 'lastName is required' })
  @MinLength(2, { message: 'lastName must be at least 2 characters' })
  @MaxLength(60, { message: 'lastName must be at most 60 characters' })
  @Matches(NAME_REGEX, {
    message: 'lastName contains characters that are not allowed',
  })
  lastName!: string;

  // Valores de wire iguales al enum de Prisma (male | female): se reusa el
  // enum generado porque coincide 1:1, sin capa de traducción. El form de
  // apps/web (masculino/femenino) mapea del lado del cliente.
  @IsOptional()
  @IsEnum(PlayerGender, { message: 'gender must be male or female' })
  gender?: PlayerGender;

  // Solo fecha, sin hora ni zona (la columna es @db.Date). El regex fija
  // el formato, @IsDateString descarta fechas inexistentes (2026-02-31),
  // y el validador propio rechaza futuras o de más de 120 años.
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'birthDate must have YYYY-MM-DD format',
  })
  @IsDateString(
    { strict: true, strictSeparator: true },
    { message: 'birthDate is not a real date' },
  )
  @IsValidBirthDate()
  birthDate?: string;

  // Texto libre en este slice: la lista de categorías es dato de producto
  // que cambia por club/país. Convertirla en enum o lookup es del slice de
  // torneos, no de este.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeTextInput(value))
  @IsString({ message: 'category must be a string' })
  @MinLength(1, { message: 'category cannot be empty' })
  @MaxLength(40, { message: 'category must be at most 40 characters' })
  category?: string;

  // Mismo criterio que `gender`: los valores de wire son los del enum de
  // Prisma (right | left) y el form de apps/web (derecho/izquierdo) mapea
  // del lado del cliente.
  @IsOptional()
  @IsEnum(PlayerHand, { message: 'dominantHand must be right or left' })
  dominantHand?: PlayerHand;

  // Código ISO 3166-1 alpha-2 ("AR"), no el nombre del país. Con texto
  // libre terminan conviviendo "Argentina", "argentina" y "ARG" como tres
  // valores distintos, y ningún filtro por país sirve después.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeCountryInput(value))
  @IsISO31661Alpha2({ message: 'country must be an ISO 3166-1 alpha-2 code' })
  country?: string;

  // Texto libre, como `category`: normalizar provincias es un problema por
  // país y no es de este slice.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeTextInput(value))
  @IsString({ message: 'province must be a string' })
  @MinLength(1, { message: 'province cannot be empty' })
  @MaxLength(80, { message: 'province must be at most 80 characters' })
  province?: string;

  // Un solo campo en E.164, con el código de país adentro. El form lo
  // parte en dos controles (select de código + número), pero eso es UI:
  // guardado en dos columnas, cualquier búsqueda o dedup por teléfono
  // tendría que rearmarlo.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizePhoneInput(value))
  @Matches(E164_REGEX, {
    message: 'phone must be in E.164 format, e.g. +5492284123456',
  })
  phone?: string;

  // Teléfono de un tercero (contacto ante emergencia), no del jugador.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizePhoneInput(value))
  @Matches(E164_REGEX, {
    message: 'emergencyPhone must be in E.164 format, e.g. +5492284123456',
  })
  emergencyPhone?: string;
}

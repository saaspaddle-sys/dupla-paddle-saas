import { registerDecorator, ValidationOptions } from 'class-validator';
import bcrypt from 'bcryptjs';

/**
 * Lógica pura, separada de `registerDecorator` para poder testearla sin
 * pasar por la maquinaria de class-validator.
 *
 * `@MaxLength` cuenta caracteres (UTF-16 code units); bcrypt trunca por
 * *bytes* UTF-8. Una contraseña de 72 caracteres acentuados ya son más de
 * 72 bytes: pasaría `@MaxLength(72)` y bcryptjs la truncaría en silencio,
 * haciendo que dos contraseñas distintas que compartan los primeros 72
 * bytes autentiquen igual. `bcrypt.truncates()` usa la misma cuenta de
 * bytes que `bcrypt.hash()`, así que no hay que reimplementarla.
 */
export function noBcryptTruncation(value: unknown): boolean {
  return typeof value === 'string' && !bcrypt.truncates(value);
}

export function NoBcryptTruncation(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'noBcryptTruncation',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: noBcryptTruncation,
        defaultMessage(): string {
          return 'password must be at most 72 bytes';
        },
      },
    });
  };
}

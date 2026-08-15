import { registerDecorator, ValidationOptions } from 'class-validator';

const MAX_AGE_YEARS = 120;

/**
 * Lógica pura, separada de `registerDecorator` para poder testearla sin
 * pasar por la maquinaria de class-validator.
 */
export function isValidBirthDate(
  value: unknown,
  now: Date = new Date(),
): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  if (date.getTime() > now.getTime()) {
    return false;
  }
  // `date` siempre cae en medianoche UTC (se construye con
  // `T00:00:00.000Z`); `limit` tiene que caer ahí también, o alguien
  // nacido hace exactamente MAX_AGE_YEARS años queda rechazado por
  // unas horas de diferencia con `now`.
  const limit = new Date(now);
  limit.setUTCFullYear(limit.getUTCFullYear() - MAX_AGE_YEARS);
  limit.setUTCHours(0, 0, 0, 0);
  return date.getTime() >= limit.getTime();
}

/**
 * Complementa `@IsDateString({ strict: true })`: ese decorador ya descarta
 * fechas inexistentes (2026-02-31). Este valida el rango de negocio —
 * ninguna fecha de nacimiento puede ser futura ni implicar más de
 * `MAX_AGE_YEARS`.
 */
export function IsValidBirthDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidBirthDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isValidBirthDate(value);
        },
        defaultMessage(): string {
          return 'birthDate is not a valid birth date';
        },
      },
    });
  };
}

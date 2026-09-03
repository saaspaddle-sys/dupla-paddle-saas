import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Lógica pura, separada de `registerDecorator` para poder testearla sin
 * pasar por la maquinaria de class-validator. Compara por identidad: sirve
 * para los tipos primitivos que llegan por el body ya validados.
 */
export function isDifferentFrom(value: unknown, other: unknown): boolean {
  return value !== other;
}

/**
 * Valida que un campo no sea igual a otro del mismo DTO. Existe para que
 * "los dos jugadores de la dupla son el mismo" se rechace como
 * `400 validation` en el borde, y no llegue al CHECK de la base
 * (`player1_id < player2_id`), que solo sabe devolver un 500.
 */
export function IsDifferentFrom(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDifferentFrom',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [related] = args.constraints as [string];
          const siblings = args.object as Record<string, unknown>;
          return isDifferentFrom(value, siblings[related]);
        },
        defaultMessage(args: ValidationArguments): string {
          const [related] = args.constraints as [string];
          return `${args.property} must be different from ${related}`;
        },
      },
    });
  };
}

import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

interface FieldError {
  field: string;
  messages: string[];
}

/**
 * `forbidNonWhitelisted` es el único constraint sin mensaje propio: su
 * texto ("property X should not exist") lo fija class-validator y no se
 * puede sobrescribir por `message` como en el resto de los decoradores.
 * Se reescribe acá para que quede con el mismo fraseo y comillado que los
 * mensajes propios, y se lo identifica por nombre de constraint en vez de
 * por texto, para no depender de que ese texto no cambie entre versiones.
 */
function messageFor(
  constraintKey: string,
  originalText: string,
  field: string,
): string {
  if (constraintKey === 'whitelistValidation') {
    return `property '${field}' is not allowed`;
  }
  return originalText;
}

/**
 * Aplana errores de class-validator (incluidos los anidados en `children`)
 * a una lista plana por campo, con el path completo separado por puntos.
 */
function flatten(errors: ValidationError[], parentPath = ''): FieldError[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const messages = error.constraints
      ? Object.entries(error.constraints).map(([key, text]) =>
          messageFor(key, text, error.property),
        )
      : [];
    const own: FieldError[] = messages.length
      ? [{ field: path, messages }]
      : [];
    const children = error.children?.length
      ? flatten(error.children, path)
      : [];
    return [...own, ...children];
  });
}

/**
 * `exceptionFactory` del `ValidationPipe` global. Produce el mismo shape de
 * error que el resto de la API (`AppExceptionFilter` lo respeta tal cual
 * porque ya trae `code`/`message`/`details`).
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    code: 'validation',
    message: 'the request has invalid fields',
    details: flatten(errors),
  });
}

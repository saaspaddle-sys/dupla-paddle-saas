import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
}

interface AppErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Mapeo por status para excepciones de Nest que no traen `code` propio
 * (`NotFoundException`, guards, etc). Cualquier status no listado cae en
 * 'error' (4xx) o 'internal_error' (5xx) — ver resolve().
 */
const CODE_BY_STATUS: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'invalid_request',
  [HttpStatus.UNAUTHORIZED]: 'unauthenticated',
  [HttpStatus.FORBIDDEN]: 'forbidden',
  [HttpStatus.NOT_FOUND]: 'not_found',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'method_not_allowed',
  [HttpStatus.CONFLICT]: 'conflict',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'unsupported_media_type',
  [HttpStatus.TOO_MANY_REQUESTS]: 'too_many_requests',
};

const INTERNAL_ERROR_MESSAGE = 'an unexpected error occurred';

/**
 * Filtro global de excepciones: fija el shape de error único que
 * `docs/api-conventions.md` deja pendiente. Las cuatro claves están
 * siempre presentes; `details` es `null` cuando no aplica, nunca una
 * clave ausente — así el cliente tipa un solo shape.
 *
 * Nunca deja salir un stack, un mensaje de Postgres/Prisma ni un nombre
 * de constraint: eso se loguea del lado del servidor y listo.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.resolve(exception);

    if (body.statusCode >= 500) {
      this.logger.error(this.describe(exception));
    }

    response.status(body.statusCode).json(body);
  }

  private resolve(exception: unknown): ErrorBody {
    if (this.isBodyParserError(exception)) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'invalid_json',
        message: 'the request body is not valid JSON',
        details: null,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();

      if (this.isAppPayload(payload)) {
        return {
          statusCode,
          code: payload.code,
          message: payload.message,
          details: payload.details ?? null,
        };
      }

      // Un HttpException de 5xx sin `code` propio (p. ej. alguien tira
      // `new InternalServerErrorException(err.message)`) no debe filtrar
      // ese mensaje interno — es exactamente lo que este filtro promete
      // no dejar salir.
      if (statusCode >= 500) {
        return {
          statusCode,
          code: CODE_BY_STATUS[statusCode] ?? 'internal_error',
          message: INTERNAL_ERROR_MESSAGE,
          details: null,
        };
      }

      return {
        statusCode,
        code: CODE_BY_STATUS[statusCode] ?? 'error',
        message: typeof payload === 'string' ? payload : exception.message,
        details: null,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'internal_error',
      message: INTERNAL_ERROR_MESSAGE,
      details: null,
    };
  }

  private isBodyParserError(exception: unknown): boolean {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      (exception as { type?: unknown }).type === 'entity.parse.failed'
    );
  }

  private isAppPayload(payload: unknown): payload is AppErrorPayload {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      typeof (payload as { code?: unknown }).code === 'string' &&
      typeof (payload as { message?: unknown }).message === 'string'
    );
  }

  private describe(exception: unknown): string {
    return exception instanceof Error
      ? (exception.stack ?? exception.message)
      : String(exception);
  }
}

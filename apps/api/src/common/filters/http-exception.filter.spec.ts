import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AppExceptionFilter } from './http-exception.filter';

function createHost(): {
  host: ArgumentsHost;
  json: jest.Mock;
  status: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, json, status };
}

/**
 * `.mock.calls` de un `jest.Mock` sin generics tipa cada entrada como
 * `any`; pasar por `unknown` primero evita que el lint marque cada
 * indexado como acceso inseguro.
 */
function respondedBody<T>(json: jest.Mock): T {
  const calls = json.mock.calls as unknown[][];
  return calls[0][0] as T;
}

describe('AppExceptionFilter', () => {
  let filter: AppExceptionFilter;

  beforeEach(() => {
    filter = new AppExceptionFilter();
  });

  it('keeps code/message/details as-is when the exception already carries them', () => {
    const { host, json, status } = createHost();
    const exception = new ConflictException({
      code: 'dni_has_account',
      message: 'the dni is already linked to an account',
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      code: 'dni_has_account',
      message: 'the dni is already linked to an account',
      details: null,
    });
  });

  it('maps an HttpException without its own code by status (fixed table)', () => {
    const { host, json } = createHost();

    filter.catch(new NotFoundException(), host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      code: 'not_found',
      message: 'Not Found',
      details: null,
    });
  });

  it('maps entity.parse.failed (body-parser) to 400 invalid_json', () => {
    const { host, json, status } = createHost();
    const bodyParserError = {
      type: 'entity.parse.failed',
      message: 'Unexpected token',
    };

    filter.catch(bodyParserError, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'invalid_json',
      message: 'the request body is not valid JSON',
      details: null,
    });
  });

  it('falls back to a generic 500 internal_error for a completely unknown exception', () => {
    const { host, json, status } = createHost();

    filter.catch(new Error('something blew up inside'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'internal_error',
      message: 'an unexpected error occurred',
      details: null,
    });
  });

  it('never leaks the internal message of a 5xx HttpException without its own code', () => {
    // Es exactamente el patrón que rompería la garantía del filtro si
    // alguien lo escribe: `new InternalServerErrorException(internalDetail)`.
    const { host, json } = createHost();
    const internalDetail =
      'duplicate key value violates unique constraint "players_dni_key"';

    filter.catch(new InternalServerErrorException(internalDetail), host);

    const body = respondedBody<{ message: string }>(json);
    expect(body.message).toBe('an unexpected error occurred');
    expect(body.message).not.toContain('players_dni_key');
  });

  it('always responds with the four keys, even when the payload is just a string', () => {
    const { host, json } = createHost();

    filter.catch(new BadRequestException('simple message'), host);

    const body = respondedBody<Record<string, unknown>>(json);
    expect(Object.keys(body).sort()).toEqual([
      'code',
      'details',
      'message',
      'statusCode',
    ]);
    expect(body.message).toBe('simple message');
  });

  it('keeps the `details` of a validation exception', () => {
    const { host, json } = createHost();
    const details = [
      { field: 'dni', messages: ['dni must have 7 or 8 digits'] },
    ];

    filter.catch(
      new BadRequestException({
        code: 'validation',
        message: 'the request has invalid fields',
        details,
      }),
      host,
    );

    const body = respondedBody<{ details: unknown; statusCode: number }>(json);
    expect(body.details).toEqual(details);
    expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST);
  });
});

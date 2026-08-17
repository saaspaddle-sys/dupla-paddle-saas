import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { validationExceptionFactory } from './validation-exception.factory';

function body(exception: BadRequestException): {
  code: string;
  message: string;
  details: { field: string; messages: string[] }[];
} {
  return exception.getResponse() as {
    code: string;
    message: string;
    details: { field: string; messages: string[] }[];
  };
}

function simpleError(
  property: string,
  constraints: Record<string, string>,
): ValidationError {
  const error = new ValidationError();
  error.property = property;
  error.constraints = constraints;
  return error;
}

describe('validationExceptionFactory', () => {
  it('produces the { code, message, details } shape with code=validation', () => {
    const exception = validationExceptionFactory([
      simpleError('dni', { matches: 'dni must have 7 or 8 digits' }),
    ]);

    expect(exception).toBeInstanceOf(BadRequestException);
    const responseBody = body(exception);
    expect(responseBody.code).toBe('validation');
    expect(responseBody.message).toBe('the request has invalid fields');
  });

  it('groups every message of the same property under a single field', () => {
    const exception = validationExceptionFactory([
      simpleError('password', {
        minLength: 'password must be at least 8 characters',
        isString: 'password is required',
      }),
    ]);

    const { details } = body(exception);
    expect(details).toHaveLength(1);
    expect(details[0].field).toBe('password');
    expect(details[0].messages).toEqual(
      expect.arrayContaining([
        'password must be at least 8 characters',
        'password is required',
      ]),
    );
  });

  it('flattens errors nested in `children` with a dot-separated path', () => {
    const child = simpleError('street', { isString: 'street is required' });
    const parent = simpleError('address', {});
    parent.children = [child];

    const { details } = body(validationExceptionFactory([parent]));

    expect(details).toEqual([
      { field: 'address.street', messages: ['street is required'] },
    ]);
  });

  it('rewrites the whitelistValidation message (forbidNonWhitelisted)', () => {
    const error = simpleError('clubId', {
      whitelistValidation: 'property clubId should not exist',
    });

    const { details } = body(validationExceptionFactory([error]));

    expect(details[0].messages).toEqual(["property 'clubId' is not allowed"]);
    expect(details[0].messages.join()).not.toMatch(/should not exist/);
  });

  it('does not add an empty entry for an error without constraints, but still processes its children', () => {
    const child = simpleError('email', {
      isEmail: 'email must be a valid address',
    });
    const parent = new ValidationError();
    parent.property = 'contact';
    parent.children = [child];

    const { details } = body(validationExceptionFactory([parent]));

    expect(details).toEqual([
      { field: 'contact.email', messages: ['email must be a valid address'] },
    ]);
  });
});

import { isSwaggerEnabled } from './swagger.setup';

describe('isSwaggerEnabled', () => {
  it('está habilitado por default fuera de producción', () => {
    expect(isSwaggerEnabled({})).toBe(true);
    expect(isSwaggerEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(isSwaggerEnabled({ NODE_ENV: 'test' })).toBe(true);
  });

  it('está deshabilitado por default en producción', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('SWAGGER_ENABLED gana sobre NODE_ENV en los dos sentidos', () => {
    expect(
      isSwaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }),
    ).toBe(true);
    expect(
      isSwaggerEnabled({ NODE_ENV: 'development', SWAGGER_ENABLED: 'false' }),
    ).toBe(false);
  });

  it('trata cualquier valor que no sea "true" como deshabilitado', () => {
    expect(isSwaggerEnabled({ SWAGGER_ENABLED: '1' })).toBe(false);
    expect(isSwaggerEnabled({ SWAGGER_ENABLED: '' })).toBe(false);
  });
});

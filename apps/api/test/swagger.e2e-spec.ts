import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import {
  API_TAGS,
  JWT_SECURITY_SCHEME,
  SWAGGER_PATH,
  setupSwagger,
} from './../src/swagger/swagger.setup';

describe('Swagger (e2e)', () => {
  let app: INestApplication<App>;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // `main.ts` lo llama antes de listen(); acá, antes de init(), por lo mismo.
    setupSwagger(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get(`/${SWAGGER_PATH}/json`)
      .expect(200);
    document = response.body as OpenAPIObject;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sirve un documento OpenAPI 3', () => {
    expect(document.openapi).toMatch(/^3\./);
    expect(document.info.title).toBe('dupla API');
  });

  it('declara las tres clases de endpoint como tags', () => {
    const tags = (document.tags ?? []).map((tag) => tag.name);
    expect(tags).toEqual(expect.arrayContaining(Object.values(API_TAGS)));
  });

  it('declara el security scheme del JWT', () => {
    expect(document.components?.securitySchemes).toHaveProperty(
      JWT_SECURITY_SCHEME,
    );
  });

  it('incluye las rutas registradas', () => {
    expect(Object.keys(document.paths)).toContain('/auth/register');
  });

  it('sirve la UI', async () => {
    const response = await request(app.getHttpServer())
      .get(`/${SWAGGER_PATH}`)
      .expect(200);
    expect(response.text).toContain('swagger-ui');
  });
});

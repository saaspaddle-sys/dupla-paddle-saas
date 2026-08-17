import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
}

/**
 * Archivo separado y a propósito **sin** `.overrideGuard(ThrottlerGuard)`:
 * es el único lugar donde se prueba el límite real. Jest le da a cada
 * archivo `*.e2e-spec.ts` su propio registro de módulos, así que el
 * `ThrottlerStorageService` (in-memory) de este `AppModule` es independiente
 * del de `login.e2e-spec.ts` — no hay interferencia entre los dos.
 */
describe('POST /auth/login rate limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('429 too_many_requests: blocks after 5 attempts within the window, with the standard error shape', async () => {
    // Distinto email en cada intento: lo que se limita es el volumen de
    // requests desde la misma IP, no un usuario puntual.
    const email = () => `throttle-${randomUUID()}@dupla.test`;

    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: email(), password: 'password123' });
      expect(response.status).toBe(401);
    }

    const blocked = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email(), password: 'password123' });

    expect(blocked.status).toBe(429);
    const body = blocked.body as ErrorBody;
    expect(body.code).toBe('too_many_requests');
    expect(Object.keys(body).sort()).toEqual([
      'code',
      'details',
      'message',
      'statusCode',
    ]);
  });

  it('429 too_many_requests: POST /auth/register has its own, independent limit', async () => {
    // El guard corre antes que el `ValidationPipe` (Guards -> Pipes en el
    // pipeline de Nest), así que un body vacío ya cuenta para el límite —
    // no hace falta un dni/email válido para ejercitar el throttle.
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({});
      expect(response.status).toBe(400);
    }

    const blocked = await request(app.getHttpServer())
      .post('/auth/register')
      .send({});

    expect(blocked.status).toBe(429);
    const body = blocked.body as ErrorBody;
    expect(body.code).toBe('too_many_requests');
  });
});

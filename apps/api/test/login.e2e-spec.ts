import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
}

interface LoginResponseBody {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

interface CurrentUserResponseBody {
  id: string;
  email: string;
  player: {
    id: string;
    firstName: string;
    lastName: string;
    category: string | null;
    gender: string | null;
  } | null;
}

describe('POST /auth/login and GET /auth/me (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = randomUUID().slice(0, 8);
  const numericSuffix = parseInt(suffix, 16) % 1_000_000;
  const createdEmails = new Set<string>();
  const createdDnis = new Set<string>();

  function testEmail(testCase: string): string {
    const email = `login-${testCase}-${suffix}@dupla.test`;
    createdEmails.add(email);
    return email;
  }

  function testDni(offset: number): string {
    const dni = `8${String((numericSuffix + offset) % 1_000_000).padStart(6, '0')}`;
    createdDnis.add(dni);
    return dni;
  }

  async function registerPlayer(overrides: {
    email: string;
    password: string;
    dni: string;
  }) {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        ...overrides,
        firstName: 'Juan',
        lastName: 'Pérez',
      })
      .expect(201);
  }

  beforeAll(async () => {
    // El guard de throttling se neutraliza acá: este archivo no testea rate
    // limiting (eso vive en `auth-throttle.e2e-spec.ts`, en su propio
    // módulo/storage), y de otro modo los múltiples POST /auth/register y
    // /auth/login de esta suite chocarían con el límite de 5/min.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.player.deleteMany({
      where: { dni: { in: [...createdDnis] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [...createdEmails] } },
    });
    await app.close();
  });

  it('200: logs in with the right credentials and returns an access token', async () => {
    const email = testEmail('ok');
    const dni = testDni(1);
    await registerPlayer({ email, password: 'password123', dni });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' });

    expect(response.status).toBe(200);
    const body = response.body as LoginResponseBody;
    expect(body.tokenType).toBe('Bearer');
    expect(body.expiresIn).toBe(60 * 60 * 24 * 7);
    expect(typeof body.accessToken).toBe('string');
    expect(body.accessToken.length).toBeGreaterThan(0);
  });

  it('401 invalid_credentials: the email does not exist', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testEmail('unknown'), password: 'password123' });

    expect(response.status).toBe(401);
    const body = response.body as ErrorBody;
    expect(body.code).toBe('invalid_credentials');
  });

  it('401 invalid_credentials: the same code and message as a wrong password (anti-enumeration)', async () => {
    const email = testEmail('wrong-password');
    const dni = testDni(2);
    await registerPlayer({ email, password: 'password123', dni });

    const unknownEmailResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testEmail('unknown-2'), password: 'password123' });

    const wrongPasswordResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'not-the-right-password' });

    expect(unknownEmailResponse.status).toBe(401);
    expect(wrongPasswordResponse.status).toBe(401);
    const unknownBody = unknownEmailResponse.body as ErrorBody;
    const wrongBody = wrongPasswordResponse.body as ErrorBody;
    expect(unknownBody.code).toBe(wrongBody.code);
    expect(unknownBody.message).toBe(wrongBody.message);
  });

  it('the error shape is { statusCode, code, message, details } on a failed login', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testEmail('shape'), password: 'password123' });

    expect(Object.keys(response.body as ErrorBody).sort()).toEqual([
      'code',
      'details',
      'message',
      'statusCode',
    ]);
  });

  it('400 validation: rejects a malformed email', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(response.status).toBe(400);
    const body = response.body as ErrorBody;
    expect(body.code).toBe('validation');
  });

  describe('GET /auth/me', () => {
    it('401: rejects a request without a token', async () => {
      const response = await request(app.getHttpServer()).get('/auth/me');

      expect(response.status).toBe(401);
      const body = response.body as ErrorBody;
      expect(body.code).toBe('unauthenticated');
    });

    it('401: rejects a garbage token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not-a-real-token');

      expect(response.status).toBe(401);
    });

    it('200: returns the identity of the authenticated user, with its player, and never the dni', async () => {
      const email = testEmail('me');
      const dni = testDni(3);
      await registerPlayer({ email, password: 'password123', dni });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'password123' });
      const { accessToken } = loginResponse.body as LoginResponseBody;

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      const body = response.body as CurrentUserResponseBody;
      expect(body.email).toBe(email);
      expect(body.player).not.toBeNull();
      expect(body.player?.firstName).toBe('Juan');

      const raw = JSON.stringify(response.body);
      expect(raw).not.toContain(dni);
      expect(raw.toLowerCase()).not.toContain('passwordhash');
    });
  });
});

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

interface SuccessfulRegistration {
  outcome: 'created' | 'claimed';
  user: { id: string; email: string };
  player: {
    id: string;
    firstName: string;
    lastName: string;
    category: string | null;
    gender: string | null;
    createdAt: string;
  };
}

describe('POST /auth/register (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = randomUUID().slice(0, 8);
  // Derivado del mismo sufijo random que los emails: si un run muere
  // antes del `afterAll` (Ctrl-C, timeout, otro test que falla), las
  // filas que deja no chocan con el próximo run — un DNI fijo sí lo haría,
  // porque `players.dni` es único global y la base local persiste entre
  // corridas (a diferencia de CI, que arranca de una base vacía).
  const numericSuffix = parseInt(suffix, 16) % 1_000_000;
  const createdEmails = new Set<string>();
  const createdDnis = new Set<string>();

  function testEmail(testCase: string): string {
    const email = `register-${testCase}-${suffix}@dupla.test`;
    createdEmails.add(email);
    return email;
  }

  // 7 dígitos, únicos por test vía `offset` para no colisionar entre sí.
  function testDni(offset: number): string {
    const dni = `9${String((numericSuffix + offset) % 1_000_000).padStart(6, '0')}`;
    createdDnis.add(dni);
    return dni;
  }

  beforeAll(async () => {
    // Esta suite hace muchos más de 5 POST /auth/register seguidos desde la
    // misma IP — el límite real de `@Throttle` se prueba en
    // `auth-throttle.e2e-spec.ts`, con su propio módulo, no acá.
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
    // players antes que users: el FK de players.user_id no bloquea el
    // delete (ON DELETE SET NULL), pero borrar en este orden es más
    // explícito sobre qué depende de qué.
    await prisma.player.deleteMany({
      where: { dni: { in: [...createdDnis] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [...createdEmails] } },
    });
    await app.close();
  });

  it('201: creates a new User and a new Player when the dni has no previous profile', async () => {
    const email = testEmail('new');
    const dni = testDni(1);

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
        dni,
        firstName: 'Juan',
        lastName: 'Pérez',
      });

    expect(response.status).toBe(201);
    const body = response.body as SuccessfulRegistration;
    expect(body).toEqual({
      outcome: 'created',
      user: { id: expect.any(String) as string, email },
      player: {
        id: expect.any(String) as string,
        firstName: 'Juan',
        lastName: 'Pérez',
        category: null,
        gender: null,
        createdAt: expect.any(String) as string,
      },
    });

    // El DNI y el hash de contraseña no salen en ningún nivel de la
    // respuesta — Ley 25.326, regla dura sin excepciones (ver docs/decisions.md).
    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain(dni);
    expect(raw.toLowerCase()).not.toContain('passwordhash');
  });

  it('201: normalizes a dni with dots and dashes before persisting it', async () => {
    const email = testEmail('normalized-dni');
    const digits = testDni(2); // 7 dígitos, p. ej. "9123456"
    const punctuatedDni = `${digits.slice(0, 2)}.${digits.slice(2, 4)}-${digits.slice(4)}`;

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
        dni: punctuatedDni,
        firstName: 'Ana',
        lastName: 'Gómez',
      });

    expect(response.status).toBe(201);

    const stored = await prisma.player.findUnique({
      where: { dni: digits },
    });
    expect(stored).not.toBeNull();
  });

  it('201: normalizes an email with spaces and uppercase before persisting it', async () => {
    const dni = testDni(3);
    const normalizedEmail = `register-normalized-email-${suffix}@dupla.test`;
    createdEmails.add(normalizedEmail);
    const rawEmail = `  ${normalizedEmail.toUpperCase()}  `;

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: rawEmail,
        password: 'password123',
        dni,
        firstName: 'Ana',
        lastName: 'Gómez',
      });

    expect(response.status).toBe(201);
    const body = response.body as SuccessfulRegistration;
    expect(body.user.email).toBe(normalizedEmail);

    const stored = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    expect(stored).not.toBeNull();
  });

  it('201: claims an ownerless Player instead of duplicating it', async () => {
    const dni = testDni(4);
    const email = testEmail('claim');

    const orphan = await prisma.player.create({
      data: {
        dni,
        firstName: 'Carlos',
        lastName: 'Preexisting',
        userId: null,
      },
    });

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
        dni,
        firstName: 'Carlos',
        lastName: 'Preexisting',
      });

    expect(response.status).toBe(201);
    const body = response.body as SuccessfulRegistration;
    expect(body.outcome).toBe('claimed');
    // Mismo id: se vinculó el perfil existente, no se creó uno nuevo.
    expect(body.player.id).toBe(orphan.id);

    const total = await prisma.player.count({ where: { dni } });
    expect(total).toBe(1);

    const updated = await prisma.player.findUniqueOrThrow({
      where: { id: orphan.id },
    });
    expect(updated.userId).not.toBeNull();
  });

  it('409 dni_has_account: the dni is already linked to another account', async () => {
    const dni = testDni(5);
    const originalOwnerEmail = testEmail('original-owner');
    const firstResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: originalOwnerEmail,
        password: 'password123',
        dni,
        firstName: 'Laura',
        lastName: 'Díaz',
      });
    expect(firstResponse.status).toBe(201);

    const attemptEmail = testEmail('someone-elses-dni-attempt');
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: attemptEmail,
        password: 'password123',
        dni,
        firstName: 'Laura',
        lastName: 'Díaz',
      });

    expect(response.status).toBe(409);
    const body = response.body as ErrorBody;
    expect(body.code).toBe('dni_has_account');
    // Sin revelar a quién pertenece: el mensaje no puede mencionar el
    // email real del dueño.
    expect(JSON.stringify(body)).not.toContain(originalOwnerEmail);
  });

  it('409 email_registered: the email already has an account', async () => {
    const email = testEmail('duplicate-email');
    const firstDni = testDni(6);
    const firstResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
        dni: firstDni,
        firstName: 'Marcos',
        lastName: 'Ruiz',
      });
    expect(firstResponse.status).toBe(201);

    const secondDni = testDni(7);
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
        dni: secondDni,
        firstName: 'Marcos',
        lastName: 'Ruiz',
      });

    expect(response.status).toBe(409);
    const body = response.body as ErrorBody;
    expect(body.code).toBe('email_registered');

    // El segundo intento no debe haber creado un Player con el segundo DNI.
    const notCreated = await prisma.player.findUnique({
      where: { dni: secondDni },
    });
    expect(notCreated).toBeNull();
  });

  it('400 validation: a dni with letters does not pass the expected format', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: testEmail('invalid-dni'),
        password: 'password123',
        dni: '12345678X',
        firstName: 'Test',
        lastName: 'Invalid',
      });

    expect(response.status).toBe(400);
    const body = response.body as ErrorBody;
    expect(body.code).toBe('validation');
    expect(Array.isArray(body.details)).toBe(true);
  });

  it('400 validation: an unknown property in the body is rejected (whitelist)', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: testEmail('unknown-property'),
        password: 'password123',
        dni: testDni(8),
        firstName: 'Test',
        lastName: 'Unknown',
        clubId: 'should-not-exist-in-this-dto',
      });

    expect(response.status).toBe(400);
    const body = response.body as ErrorBody;
    expect(body.code).toBe('validation');
  });

  it('the error shape is { statusCode, code, message, details } on both 400 and 409', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/auth/register')
      .send({});
    expect(invalid.status).toBe(400);
    const invalidBody = invalid.body as ErrorBody;
    expect(Object.keys(invalidBody).sort()).toEqual([
      'code',
      'details',
      'message',
      'statusCode',
    ]);

    const email = testEmail('shape-409');
    const dni = testDni(9);
    await request(app.getHttpServer()).post('/auth/register').send({
      email,
      password: 'password123',
      dni,
      firstName: 'Test',
      lastName: 'Shape',
    });
    const conflict = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
        dni: testDni(10),
        firstName: 'Test',
        lastName: 'Shape',
      });
    expect(conflict.status).toBe(409);
    const conflictBody = conflict.body as ErrorBody;
    expect(Object.keys(conflictBody).sort()).toEqual([
      'code',
      'details',
      'message',
      'statusCode',
    ]);
    expect(conflictBody.details).toBeNull();
  });

  it('201: accepts a valid birth date', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: testEmail('valid-date'),
        password: 'password123',
        dni: testDni(11),
        firstName: 'Test',
        lastName: 'ValidDate',
        birthDate: '1990-05-20',
      });

    expect(response.status).toBe(201);
  });

  it('400 validation: rejects a future birth date', async () => {
    const futureYear = new Date().getUTCFullYear() + 1;

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: testEmail('future-date'),
        password: 'password123',
        dni: testDni(12),
        firstName: 'Test',
        lastName: 'FutureDate',
        birthDate: `${futureYear}-01-01`,
      });

    expect(response.status).toBe(400);
    const body = response.body as ErrorBody;
    expect(body.code).toBe('validation');
  });
});

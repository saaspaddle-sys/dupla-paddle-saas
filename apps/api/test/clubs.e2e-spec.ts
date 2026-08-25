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

interface ClubResponseBody {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  subscription: {
    plan: string;
    status: string;
    maxTournaments: number;
  };
}

interface CurrentUserResponseBody {
  id: string;
  email: string;
  player: unknown;
  club: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
}

describe('Clubs (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = randomUUID().slice(0, 8);
  const numericSuffix = parseInt(suffix, 16) % 1_000_000;
  const createdEmails = new Set<string>();
  const createdDnis = new Set<string>();
  const createdSlugPrefixes = new Set<string>();

  function testEmail(testCase: string): string {
    const email = `clubs-${testCase}-${suffix}@dupla.test`;
    createdEmails.add(email);
    return email;
  }

  // 7 dígitos, únicos por test vía `offset` — mismo criterio que
  // `register-player.e2e-spec.ts`: la base local persiste entre corridas y
  // `players.dni` es único global.
  function testDni(offset: number): string {
    const dni = `7${String((numericSuffix + offset) % 1_000_000).padStart(6, '0')}`;
    createdDnis.add(dni);
    return dni;
  }

  /** Nombre de club derivable a un slug único por corrida. */
  function testClubName(testCase: string): string {
    const name = `Club ${testCase} ${suffix}`;
    createdSlugPrefixes.add(`club-${testCase}-${suffix}`);
    return name;
  }

  /** Registra una cuenta y devuelve su access token. */
  async function signUp(testCase: string, dniOffset: number): Promise<string> {
    const email = testEmail(testCase);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
        dni: testDni(dniOffset),
        firstName: 'Juan',
        lastName: 'Pérez',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);

    return (response.body as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    // El throttler se neutraliza: esta suite hace muchos más de 5
    // POST /auth/register y POST /clubs seguidos desde la misma IP. El
    // límite real se prueba en `auth-throttle.e2e-spec.ts`.
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
    // Orden inverso al de las FKs: `clubs.owner_id` es `Restrict`, así que
    // los clubes tienen que irse antes que sus dueños.
    for (const prefix of createdSlugPrefixes) {
      await prisma.club.deleteMany({ where: { slug: { startsWith: prefix } } });
    }
    await prisma.subscription.deleteMany({
      where: { user: { email: { in: [...createdEmails] } } },
    });
    await prisma.player.deleteMany({
      where: { dni: { in: [...createdDnis] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [...createdEmails] } },
    });
    await app.close();
  });

  describe('POST /clubs', () => {
    it('201: creates the club with a derived slug and a pending basic subscription', async () => {
      const token = await signUp('create', 1);

      const response = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: testClubName('create') });

      expect(response.status).toBe(201);
      const body = response.body as ClubResponseBody;
      expect(body.name).toBe(`Club create ${suffix}`);
      expect(body.slug).toBe(`club-create-${suffix}`);
      expect(body.status).toBe('active');
      expect(body.subscription).toEqual({
        plan: 'basic',
        status: 'pending',
        maxTournaments: 3,
      });
    });

    // Se fija el set exacto de claves y no solo la ausencia de `ownerId`:
    // el mapper es manual justamente para que un campo nuevo del schema no
    // salga solo, y esto es lo que lo detecta.
    it('201: exposes exactly the contracted fields, and no owner data', async () => {
      const token = await signUp('shape', 2);
      const meResponse = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const ownerId = (meResponse.body as CurrentUserResponseBody).id;

      const response = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: testClubName('shape') })
        .expect(201);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'createdAt',
        'id',
        'name',
        'slug',
        'status',
        'subscription',
        'updatedAt',
      ]);
      expect(JSON.stringify(response.body)).not.toContain(ownerId);
    });

    it('401 unauthenticated: without a token', async () => {
      const response = await request(app.getHttpServer())
        .post('/clubs')
        .send({ name: testClubName('no-token') });

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).code).toBe('unauthenticated');
    });

    it('409 club_limit_reached: the account already owns a club', async () => {
      const token = await signUp('second', 3);
      await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: testClubName('second') })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `${testClubName('second-b')} otro` });

      expect(response.status).toBe(409);
      expect((response.body as ErrorBody).code).toBe('club_limit_reached');
    });

    it('201: suffixes the slug when two accounts pick the same club name', async () => {
      const name = testClubName('twin');
      const firstToken = await signUp('twin-a', 4);
      const secondToken = await signUp('twin-b', 5);

      const first = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${firstToken}`)
        .send({ name })
        .expect(201);
      const second = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${secondToken}`)
        .send({ name })
        .expect(201);

      expect((first.body as ClubResponseBody).slug).toBe(`club-twin-${suffix}`);
      expect((second.body as ClubResponseBody).slug).toBe(
        `club-twin-${suffix}-2`,
      );
    });

    it('400 validation: an empty name', async () => {
      const token = await signUp('bad-name', 6);

      const response = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).code).toBe('validation');
    });

    // Los dos casos que *son* el invariante de tenancy: el cliente no puede
    // elegir de qué club es dueño, ni siquiera mandándolo en el body. No es
    // un campo ignorado en silencio — es un 400, cortesía de
    // `forbidNonWhitelisted`.
    it('400 validation: rejects an ownerId planted in the body', async () => {
      const token = await signUp('owner-id', 7);

      const response = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: testClubName('owner-id'), ownerId: randomUUID() });

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).code).toBe('validation');
    });

    it('400 validation: rejects a clubId planted in the body', async () => {
      const token = await signUp('club-id', 8);

      const response = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: testClubName('club-id'), clubId: randomUUID() });

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).code).toBe('validation');
    });

    // El slug dejó de ser un campo de entrada en este slice: el server lo
    // deriva siempre. Mandarlo es un campo no declarado, no una preferencia.
    it('400 validation: rejects a client-chosen slug', async () => {
      const token = await signUp('slug-input', 9);

      const response = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: testClubName('slug-input'), slug: 'elegido-a-mano' });

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).code).toBe('validation');
    });
  });

  describe('GET /clubs/me', () => {
    it('200: returns the club of the authenticated account', async () => {
      const token = await signUp('get-mine', 10);
      const created = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: testClubName('get-mine') })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/clubs/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect((response.body as ClubResponseBody).id).toBe(
        (created.body as ClubResponseBody).id,
      );
      expect((response.body as ClubResponseBody).subscription.plan).toBe(
        'basic',
      );
    });

    // El otro caso que es el invariante: autenticado pero sin club es 403,
    // no 404 — la cuenta existe, lo que falta es la condición que el
    // endpoint exige.
    it('403 club_required: an authenticated account with no club', async () => {
      const token = await signUp('no-club', 11);

      const response = await request(app.getHttpServer())
        .get('/clubs/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect((response.body as ErrorBody).code).toBe('club_required');
    });

    it('401 unauthenticated: without a token', async () => {
      const response = await request(app.getHttpServer()).get('/clubs/me');

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).code).toBe('unauthenticated');
    });

    it('403 club_required: a token cannot read another account club', async () => {
      const ownerToken = await signUp('owner', 12);
      await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: testClubName('owner') })
        .expect(201);

      const strangerToken = await signUp('stranger', 13);
      const response = await request(app.getHttpServer())
        .get('/clubs/me')
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(response.status).toBe(403);
      expect((response.body as ErrorBody).code).toBe('club_required');
    });
  });

  describe('PATCH /clubs/me', () => {
    it('200: updates the name and returns the full representation', async () => {
      const token = await signUp('patch', 14);
      await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: testClubName('patch') })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch('/clubs/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nombre Nuevo' });

      expect(response.status).toBe(200);
      const body = response.body as ClubResponseBody;
      expect(body.name).toBe('Nombre Nuevo');
      // El slug no se re-deriva: cambiarlo rompería URLs ya publicadas.
      expect(body.slug).toBe(`club-patch-${suffix}`);
      expect(body.subscription.plan).toBe('basic');
    });

    it('200: an empty body is a no-op that returns the current state', async () => {
      const token = await signUp('patch-empty', 15);
      const created = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: testClubName('patch-empty') })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch('/clubs/me')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(200);
      const body = response.body as ClubResponseBody;
      expect(body.name).toBe((created.body as ClubResponseBody).name);
      expect(body.updatedAt).toBe((created.body as ClubResponseBody).updatedAt);
    });

    it('403 club_required: an authenticated account with no club', async () => {
      const token = await signUp('patch-no-club', 16);

      const response = await request(app.getHttpServer())
        .patch('/clubs/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nombre Nuevo' });

      expect(response.status).toBe(403);
      expect((response.body as ErrorBody).code).toBe('club_required');
    });

    it('400 validation: rejects a slug in the body', async () => {
      const token = await signUp('patch-slug', 17);
      await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: testClubName('patch-slug') })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch('/clubs/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ slug: 'otro-slug' });

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).code).toBe('validation');
    });
  });

  describe('GET /auth/me', () => {
    it('200: club is null for an account that owns no club', async () => {
      const token = await signUp('me-player', 18);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect((response.body as CurrentUserResponseBody).club).toBeNull();
    });

    // Verifica el `select` anidado de `JwtStrategy`: si alguien lo saca, el
    // frontend pierde la forma de saber si la cuenta es organizadora sin
    // comerse un 403 como flujo normal.
    it('200: club carries id, name, slug and status for an organizer', async () => {
      const token = await signUp('me-organizer', 19);
      const created = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: testClubName('me-organizer') })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect((response.body as CurrentUserResponseBody).club).toEqual({
        id: (created.body as ClubResponseBody).id,
        name: `Club me-organizer ${suffix}`,
        slug: `club-me-organizer-${suffix}`,
        status: 'active',
      });
    });

    // La suscripción no se duplica en /auth/me: es identidad, no panel.
    it('200: club does not carry the subscription', async () => {
      const token = await signUp('me-no-sub', 20);
      await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: testClubName('me-no-sub') })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(
        (response.body as CurrentUserResponseBody).club,
      ).not.toHaveProperty('subscription');
    });
  });
});

import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface ErrorBody {
  code: string;
}

interface LoginBody {
  accessToken: string;
}

describe('Organizer player directory (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  const suffix = randomUUID().slice(0, 8);
  const createdEmails = new Set<string>();
  const createdDnis = new Set<string>();
  let organizerEmail: string;
  let clubId: string;

  function email(name: string): string {
    const value = `organizer-player-${name}-${suffix}@dupla.test`;
    createdEmails.add(value);
    return value;
  }

  function dni(offset: number): string {
    const value = `8${String((parseInt(suffix, 16) + offset) % 1_000_000).padStart(6, '0')}`;
    createdDnis.add(value);
    return value;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    organizerEmail = email('staff');
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: organizerEmail,
        password: 'password123',
        dni: dni(1),
        firstName: 'Organizer',
        lastName: 'Staff',
      });
    expect(register.status).toBe(201);

    const login = await request(app.getHttpServer()).post('/auth/login').send({
      email: organizerEmail,
      password: 'password123',
    });
    token = (login.body as LoginBody).accessToken;
    const withoutClub = await request(app.getHttpServer())
      .get('/players?q=Ada')
      .set('Authorization', `Bearer ${token}`);
    expect(withoutClub.status).toBe(403);

    const club = await request(app.getHttpServer())
      .post('/clubs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Organizer Club ${suffix}` });
    expect(club.status).toBe(201);
    clubId = (club.body as { id: string }).id;
  });

  afterAll(async () => {
    await prisma.club.delete({ where: { id: clubId } });
    await prisma.player.deleteMany({
      where: { dni: { in: [...createdDnis] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [...createdEmails] } },
    });
    await app.close();
  });

  it('requires club-authorized authentication', async () => {
    const response = await request(app.getHttpServer()).get('/players?q=Ada');
    expect(response.status).toBe(401);
  });

  it('creates a global player profile with required email and safe output', async () => {
    const playerEmail = email('created');
    const playerDni = dni(2);
    const response = await request(app.getHttpServer())
      .post('/players')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: `  ${playerEmail.toUpperCase()}  `,
        dni: playerDni,
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '+54 9 2284 12-3456',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(String) as string,
      firstName: 'Ada',
      lastName: 'Lovelace',
      category: null,
      gender: null,
      createdAt: expect.any(String) as string,
    });
    expect(JSON.stringify(response.body)).not.toContain(playerDni);
    expect(JSON.stringify(response.body)).not.toContain(playerEmail);

    const stored = await prisma.player.findUniqueOrThrow({
      where: { dni: playerDni },
    });
    expect(stored.userId).toBeNull();
    expect(stored.email).toBe(playerEmail);
    expect(stored.phone).toBe('+5492284123456');
  });

  it('validates the mandatory organizer email and rejects a duplicate DNI', async () => {
    const playerDni = dni(3);
    const withoutEmail = await request(app.getHttpServer())
      .post('/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ dni: playerDni, firstName: 'Grace', lastName: 'Hopper' });
    expect(withoutEmail.status).toBe(400);
    expect((withoutEmail.body as ErrorBody).code).toBe('validation');

    const first = await request(app.getHttpServer())
      .post('/players')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: email('duplicate'),
        dni: playerDni,
        firstName: 'Grace',
        lastName: 'Hopper',
      });
    expect(first.status).toBe(201);
    const duplicate = await request(app.getHttpServer())
      .post('/players')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: email('duplicate-other'),
        dni: playerDni,
        firstName: 'Grace',
        lastName: 'Hopper',
      });
    expect(duplicate.status).toBe(409);
    expect((duplicate.body as ErrorBody).code).toBe('player_dni_exists');
  });

  it('busca por DNI sin exponerlo ni devolver datos de contacto', async () => {
    const playerDni = dni(2);
    const response = await request(app.getHttpServer())
      .get(`/players?q=${playerDni}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        expect.objectContaining({
          firstName: 'Ada',
          lastName: 'Lovelace',
        }) as unknown,
      ],
      nextCursor: null,
    });
    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain(playerDni);
    expect(raw).not.toContain(email('created'));
  });

  it('pagina la búsqueda por cursor sin repetir el último perfil', async () => {
    const searchTerm = `Cursor${suffix.replace(/\d/g, (digit) =>
      String.fromCharCode('a'.charCodeAt(0) + Number(digit)),
    )}`;
    const first = await request(app.getHttpServer())
      .post('/players')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: email('cursor-first'),
        dni: dni(4),
        firstName: searchTerm,
        lastName: 'First',
      });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/players')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: email('cursor-second'),
        dni: dni(5),
        firstName: searchTerm,
        lastName: 'Second',
      });
    expect(second.status).toBe(201);

    const firstPage = await request(app.getHttpServer())
      .get(`/players?q=${searchTerm}&limit=1`)
      .set('Authorization', `Bearer ${token}`);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.items).toHaveLength(1);
    expect(firstPage.body.nextCursor).toBe(firstPage.body.items[0].id);

    const secondPage = await request(app.getHttpServer())
      .get(
        `/players?q=${searchTerm}&limit=1&cursor=${firstPage.body.nextCursor}`,
      )
      .set('Authorization', `Bearer ${token}`);
    expect(secondPage.status).toBe(200);
    expect(secondPage.body).toMatchObject({ nextCursor: null });
    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.items[0].id).not.toBe(firstPage.body.items[0].id);
  });
});

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

interface TournamentResponseBody {
  id: string;
  name: string;
  format: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface TournamentListResponseBody {
  items: TournamentResponseBody[];
  nextCursor: string | null;
}

interface PlayerSummaryBody {
  id: string;
  firstName: string;
  lastName: string;
  category: string | null;
}

interface TeamResponseBody {
  id: string;
  tournamentId: string;
  player1: PlayerSummaryBody;
  player2: PlayerSummaryBody;
  createdAt: string;
}

describe('Tournaments and teams (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = randomUUID().slice(0, 8);
  const numericSuffix = parseInt(suffix, 16) % 1_000_000;
  const createdEmails = new Set<string>();
  const createdDnis = new Set<string>();
  const createdSlugPrefixes = new Set<string>();
  const createdClubIds = new Set<string>();
  let dniOffset = 0;

  function testEmail(testCase: string): string {
    const email = `tournaments-${testCase}-${suffix}@dupla.test`;
    createdEmails.add(email);
    return email;
  }

  // 7 dígitos, únicos por test vía un offset que se incrementa en cada
  // llamada — mismo criterio que `clubs.e2e-spec.ts`, pero sin tener que
  // llevar la cuenta a mano en cada call site.
  function testDni(): string {
    dniOffset += 1;
    const dni = `8${String((numericSuffix + dniOffset) % 1_000_000).padStart(6, '0')}`;
    createdDnis.add(dni);
    return dni;
  }

  function testClubName(testCase: string): string {
    const name = `Club ${testCase} ${suffix}`;
    createdSlugPrefixes.add(`club-${testCase}-${suffix}`);
    return name;
  }

  function testTournamentName(testCase: string): string {
    return `Torneo ${testCase} ${suffix}`;
  }

  /** Registra una cuenta y devuelve su access token. */
  async function signUp(testCase: string): Promise<string> {
    const email = testEmail(testCase);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
        dni: testDni(),
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

  /** Registra una cuenta, le crea un club, y devuelve el token y el club id. */
  async function createClub(
    testCase: string,
  ): Promise<{ token: string; clubId: string }> {
    const token = await signUp(testCase);
    const response = await request(app.getHttpServer())
      .post('/clubs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: testClubName(testCase) })
      .expect(201);

    const clubId = (response.body as { id: string }).id;
    createdClubIds.add(clubId);
    return { token, clubId };
  }

  /**
   * Registra un jugador (`POST /auth/register`, sin club) y devuelve su id
   * de `Player` y el dni usado, para poder comprobar después que ningún
   * response de `teams` lo expone.
   */
  async function registerPlayer(
    testCase: string,
  ): Promise<{ id: string; dni: string }> {
    const dni = testDni();
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: testEmail(`player-${testCase}`),
        password: 'password123',
        dni,
        firstName: 'Jugador',
        lastName: testCase,
      })
      .expect(201);

    return { id: (response.body as { player: { id: string } }).player.id, dni };
  }

  async function createTournament(
    token: string,
    testCase: string,
  ): Promise<TournamentResponseBody> {
    const response = await request(app.getHttpServer())
      .post('/tournaments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: testTournamentName(testCase) })
      .expect(201);

    return response.body as TournamentResponseBody;
  }

  beforeAll(async () => {
    // El throttler se neutraliza: esta suite hace muchos más de 5
    // POST /auth/register y POST /tournaments seguidos desde la misma IP.
    // El límite real se prueba en `auth-throttle.e2e-spec.ts`.
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
    // Orden inverso al de las FKs: `teams` referencia torneo y club,
    // `tournaments` referencia club (`Restrict`), y `clubs`/`players`
    // referencian `users` (`Restrict`).
    for (const clubId of createdClubIds) {
      await prisma.team.deleteMany({ where: { clubId } });
      await prisma.tournament.deleteMany({ where: { clubId } });
    }
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

  describe('Tenancy', () => {
    // Los cuatro casos son el mismo invariante: un torneo de otro club es
    // indistinguible de uno que no existe. Nunca 403 — eso confirmaría que
    // el id existe, que es justo el dato que un club no puede sacarle a otro.
    it('404 tournament_not_found: GET a tournament that belongs to another club', async () => {
      const clubA = await createClub('tenancy-a');
      const clubB = await createClub('tenancy-b');
      const tournament = await createTournament(clubA.token, 'tenancy-get');

      const response = await request(app.getHttpServer())
        .get(`/tournaments/${tournament.id}`)
        .set('Authorization', `Bearer ${clubB.token}`);

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).code).toBe('tournament_not_found');
    });

    it('404 tournament_not_found: PATCH a tournament that belongs to another club', async () => {
      const clubA = await createClub('tenancy-patch-a');
      const clubB = await createClub('tenancy-patch-b');
      const tournament = await createTournament(clubA.token, 'tenancy-patch');

      const response = await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}`)
        .set('Authorization', `Bearer ${clubB.token}`)
        .send({ name: 'Nombre robado' });

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).code).toBe('tournament_not_found');
    });

    it('404 tournament_not_found: lists the teams of a tournament that belongs to another club', async () => {
      const clubA = await createClub('tenancy-list-a');
      const clubB = await createClub('tenancy-list-b');
      const tournament = await createTournament(clubA.token, 'tenancy-list');

      const response = await request(app.getHttpServer())
        .get(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${clubB.token}`);

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).code).toBe('tournament_not_found');
    });

    it('404 tournament_not_found: DELETE a team of a tournament that belongs to another club', async () => {
      const clubA = await createClub('tenancy-delete-a');
      const clubB = await createClub('tenancy-delete-b');
      const tournament = await createTournament(clubA.token, 'tenancy-delete');

      const response = await request(app.getHttpServer())
        .delete(`/tournaments/${tournament.id}/teams/${randomUUID()}`)
        .set('Authorization', `Bearer ${clubB.token}`);

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).code).toBe('tournament_not_found');
    });
  });

  describe('Quota', () => {
    it('409 tournament_quota_reached with details, and cancelling one frees the quota', async () => {
      const club = await createClub('quota');

      const first = await createTournament(club.token, 'quota-1');
      await createTournament(club.token, 'quota-2');
      await createTournament(club.token, 'quota-3');

      const overQuota = await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', `Bearer ${club.token}`)
        .send({ name: testTournamentName('quota-4') });

      expect(overQuota.status).toBe(409);
      const body = overQuota.body as ErrorBody;
      expect(body.code).toBe('tournament_quota_reached');
      expect(body.details).toEqual({ max: 3, current: 3 });

      // Cancelar el primero saca una llave activa del conteo: la cuota
      // cuenta simultáneas, no acumuladas.
      await request(app.getHttpServer())
        .patch(`/tournaments/${first.id}`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ status: 'canceled' })
        .expect(200);

      const afterCancel = await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', `Bearer ${club.token}`)
        .send({ name: testTournamentName('quota-5') });

      expect(afterCancel.status).toBe(201);
    });
  });

  describe('GET /tournaments (pagination)', () => {
    it('paginates by cursor without repeating or skipping items, and nextCursor is null on the last page', async () => {
      const club = await createClub('pagination');
      const first = await createTournament(club.token, 'page-1');
      const second = await createTournament(club.token, 'page-2');
      const third = await createTournament(club.token, 'page-3');

      const firstPage = await request(app.getHttpServer())
        .get('/tournaments')
        .query({ limit: 2 })
        .set('Authorization', `Bearer ${club.token}`)
        .expect(200);
      const firstBody = firstPage.body as TournamentListResponseBody;

      expect(firstBody.items).toHaveLength(2);
      // Orden `id desc` = más nuevo primero.
      expect(firstBody.items.map((item) => item.id)).toEqual([
        third.id,
        second.id,
      ]);
      expect(firstBody.nextCursor).toBe(second.id);

      const secondPage = await request(app.getHttpServer())
        .get('/tournaments')
        .query({ limit: 2, cursor: firstBody.nextCursor })
        .set('Authorization', `Bearer ${club.token}`)
        .expect(200);
      const secondBody = secondPage.body as TournamentListResponseBody;

      expect(secondBody.items.map((item) => item.id)).toEqual([first.id]);
      expect(secondBody.nextCursor).toBeNull();

      // Ni un item repetido entre páginas, ni uno salteado.
      const seenIds = [...firstBody.items, ...secondBody.items].map(
        (item) => item.id,
      );
      expect(new Set(seenIds).size).toBe(3);
      expect(seenIds.sort()).toEqual([first.id, second.id, third.id].sort());
    });

    it('400 validation: limit below the minimum', async () => {
      const club = await createClub('pagination-limit-low');

      const response = await request(app.getHttpServer())
        .get('/tournaments')
        .query({ limit: 0 })
        .set('Authorization', `Bearer ${club.token}`);

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).code).toBe('validation');
    });

    it('400 validation: limit above the maximum', async () => {
      const club = await createClub('pagination-limit-high');

      const response = await request(app.getHttpServer())
        .get('/tournaments')
        .query({ limit: 101 })
        .set('Authorization', `Bearer ${club.token}`);

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).code).toBe('validation');
    });
  });

  describe('POST /tournaments/:tournamentId/teams', () => {
    it('201: registers a team and returns it with the canonical pair and no dni', async () => {
      const club = await createClub('register');
      const tournament = await createTournament(club.token, 'register');
      const playerA = await registerPlayer('register-a');
      const playerB = await registerPlayer('register-b');

      const response = await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ player1Id: playerA.id, player2Id: playerB.id });

      expect(response.status).toBe(201);
      const body = response.body as TeamResponseBody;
      expect(body.tournamentId).toBe(tournament.id);
      expect([body.player1.id, body.player2.id].sort()).toEqual(
        [playerA.id, playerB.id].sort(),
      );

      const raw = JSON.stringify(body);
      expect(raw).not.toContain(playerA.dni);
      expect(raw).not.toContain(playerB.dni);
    });

    it('400 validation: registering the same player as both slots', async () => {
      const club = await createClub('same-player');
      const tournament = await createTournament(club.token, 'same-player');
      const player = await registerPlayer('same-player');

      const response = await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ player1Id: player.id, player2Id: player.id });

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).code).toBe('validation');
    });

    it('404 player_not_found: one of the two players does not exist', async () => {
      const club = await createClub('missing-player');
      const tournament = await createTournament(club.token, 'missing-player');
      const existingPlayer = await registerPlayer('missing-player-existing');
      const missingPlayerId = randomUUID();

      const response = await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ player1Id: existingPlayer.id, player2Id: missingPlayerId });

      expect(response.status).toBe(404);
      const body = response.body as ErrorBody;
      expect(body.code).toBe('player_not_found');
      expect(body.details).toEqual({
        playerIds: [missingPlayerId.toLowerCase()],
      });
    });

    it('409 duplicate_team: registering the exact same pair twice', async () => {
      const club = await createClub('duplicate');
      const tournament = await createTournament(club.token, 'duplicate');
      const playerA = await registerPlayer('duplicate-a');
      const playerB = await registerPlayer('duplicate-b');

      await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ player1Id: playerA.id, player2Id: playerB.id })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ player1Id: playerA.id, player2Id: playerB.id });

      expect(response.status).toBe(409);
      expect((response.body as ErrorBody).code).toBe('duplicate_team');
    });

    // Prueba end-to-end del orden canónico: (A, B) y después (B, A) tienen
    // que colapsar a la misma fila para el índice único, no crear dos.
    it('409 duplicate_team: (A, B) and then (B, A) are the same team', async () => {
      const club = await createClub('canonical-order');
      const tournament = await createTournament(club.token, 'canonical-order');
      const playerA = await registerPlayer('canonical-order-a');
      const playerB = await registerPlayer('canonical-order-b');

      await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ player1Id: playerA.id, player2Id: playerB.id })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ player1Id: playerB.id, player2Id: playerA.id });

      expect(response.status).toBe(409);
      expect((response.body as ErrorBody).code).toBe('duplicate_team');
    });

    it('409 player_already_registered: a player already plays in a different team of the same tournament', async () => {
      const club = await createClub('already-registered');
      const tournament = await createTournament(
        club.token,
        'already-registered',
      );
      const playerA = await registerPlayer('already-registered-a');
      const playerB = await registerPlayer('already-registered-b');
      const playerC = await registerPlayer('already-registered-c');

      await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ player1Id: playerA.id, player2Id: playerB.id })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ player1Id: playerA.id, player2Id: playerC.id });

      expect(response.status).toBe(409);
      const body = response.body as ErrorBody;
      expect(body.code).toBe('player_already_registered');
      expect(body.details).toEqual({ playerIds: [playerA.id] });
    });

    // REGRESIÓN: sin normalizar a minúscula antes de comparar, este INSERT
    // moriría contra el CHECK `teams_canonical_order` como un 500 en vez de
    // devolver 201.
    it('201: registers a team when the player ids arrive in uppercase, and returns them lowercased', async () => {
      const club = await createClub('uppercase');
      const tournament = await createTournament(club.token, 'uppercase');
      const playerA = await registerPlayer('uppercase-a');
      const playerB = await registerPlayer('uppercase-b');

      const response = await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({
          player1Id: playerA.id.toUpperCase(),
          player2Id: playerB.id.toUpperCase(),
        });

      expect(response.status).toBe(201);
      const body = response.body as TeamResponseBody;
      expect([body.player1.id, body.player2.id].sort()).toEqual(
        [playerA.id, playerB.id].sort(),
      );
      expect(body.player1.id).toBe(body.player1.id.toLowerCase());
      expect(body.player2.id).toBe(body.player2.id.toLowerCase());
    });

    it('400 validation: rejects a clubId planted in the body', async () => {
      const club = await createClub('club-id-in-body');
      const tournament = await createTournament(club.token, 'club-id-in-body');
      const playerA = await registerPlayer('club-id-in-body-a');
      const playerB = await registerPlayer('club-id-in-body-b');

      const response = await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({
          player1Id: playerA.id,
          player2Id: playerB.id,
          clubId: randomUUID(),
        });

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).code).toBe('validation');
    });
  });

  describe('tournament status', () => {
    it('409 tournament_not_open: registering into a canceled tournament', async () => {
      const club = await createClub('not-open-register');
      const tournament = await createTournament(
        club.token,
        'not-open-register',
      );
      await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ status: 'canceled' })
        .expect(200);
      const playerA = await registerPlayer('not-open-register-a');
      const playerB = await registerPlayer('not-open-register-b');

      const response = await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ player1Id: playerA.id, player2Id: playerB.id });

      expect(response.status).toBe(409);
      expect((response.body as ErrorBody).code).toBe('tournament_not_open');
    });

    it('409 tournament_not_open: removing a team from a tournament that was canceled afterwards', async () => {
      const club = await createClub('not-open-remove');
      const tournament = await createTournament(club.token, 'not-open-remove');
      const playerA = await registerPlayer('not-open-remove-a');
      const playerB = await registerPlayer('not-open-remove-b');
      const team = await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ player1Id: playerA.id, player2Id: playerB.id })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ status: 'canceled' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .delete(
          `/tournaments/${tournament.id}/teams/${(team.body as TeamResponseBody).id}`,
        )
        .set('Authorization', `Bearer ${club.token}`);

      expect(response.status).toBe(409);
      expect((response.body as ErrorBody).code).toBe('tournament_not_open');
    });
  });

  describe('DELETE /tournaments/:tournamentId/teams/:teamId', () => {
    it('204: removes a team, with no body', async () => {
      const club = await createClub('delete');
      const tournament = await createTournament(club.token, 'delete');
      const playerA = await registerPlayer('delete-a');
      const playerB = await registerPlayer('delete-b');
      const team = await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ player1Id: playerA.id, player2Id: playerB.id })
        .expect(201);

      const response = await request(app.getHttpServer())
        .delete(
          `/tournaments/${tournament.id}/teams/${(team.body as TeamResponseBody).id}`,
        )
        .set('Authorization', `Bearer ${club.token}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});

      const list = await request(app.getHttpServer())
        .get(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .expect(200);
      expect(list.body as TeamResponseBody[]).toEqual([]);
    });

    it('404 team_not_found: the team does not exist in that tournament', async () => {
      const club = await createClub('delete-missing');
      const tournament = await createTournament(club.token, 'delete-missing');

      const response = await request(app.getHttpServer())
        .delete(`/tournaments/${tournament.id}/teams/${randomUUID()}`)
        .set('Authorization', `Bearer ${club.token}`);

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).code).toBe('team_not_found');
    });
  });

  describe('GET /tournaments/:tournamentId/teams', () => {
    it('never exposes the dni of either player', async () => {
      const club = await createClub('list-no-dni');
      const tournament = await createTournament(club.token, 'list-no-dni');
      const playerA = await registerPlayer('list-no-dni-a');
      const playerB = await registerPlayer('list-no-dni-b');
      await request(app.getHttpServer())
        .post(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ player1Id: playerA.id, player2Id: playerB.id })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .expect(200);

      const raw = JSON.stringify(response.body);
      expect(raw).not.toContain(playerA.dni);
      expect(raw).not.toContain(playerB.dni);
      const team = (response.body as TeamResponseBody[])[0];
      expect(team.player1).not.toHaveProperty('dni');
      expect(team.player2).not.toHaveProperty('dni');
    });
  });
});

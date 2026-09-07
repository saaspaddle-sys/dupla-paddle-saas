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
  seed: number | null;
  createdAt: string;
}

interface BracketMatchBody {
  id: string;
  round: number;
  position: number;
  teamA: { id: string; seed: number | null } | null;
  teamB: { id: string; seed: number | null } | null;
  winnerTeamId: string | null;
  status: string;
  outcome: string | null;
  nextMatchId: string | null;
  nextSlot: string | null;
}

interface BracketResponseBody {
  tournamentId: string;
  bracketSize: number;
  roundCount: number;
  byeCount: number;
  matches: BracketMatchBody[];
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
   * Sube la cuota del club por debajo de la API. Todo club nace en el plan
   * `free`, que permite una sola llave activa, y hay tests que necesitan
   * varios torneos vivos a la vez sin que la cuota sea lo que están
   * probando. No existe endpoint de upgrade —el cambio de plan es manual
   * mientras el cobro lo sea—, así que el fixture escribe la suscripción
   * directo.
   */
  async function raiseQuota(clubId: string, maxTournaments: number) {
    await prisma.subscription.updateMany({
      where: { user: { clubs: { some: { id: clubId } } } },
      data: { maxTournaments },
    });
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

  /**
   * Crea perfiles de jugador **directo por Prisma**, sin `POST /auth/register`.
   *
   * Es a propósito y no un atajo perezoso: el registro hashea con bcrypt, que
   * es lento por diseño, y un test de cuadro necesita hasta doce jugadores.
   * Pasarlos todos por el endpoint agregaba más de un minuto a la suite y la
   * hacía tumbar por timeout a los tests de otros archivos que corren en
   * paralelo. Lo que estos tests prueban es el bracket, no el alta de
   * jugadores — eso tiene su propia suite.
   *
   * Un `Player` sin `userId` es un perfil precargado por un club, que es un
   * estado válido del modelo (ver `docs/data-model.md`), así que el fixture no
   * inventa nada que la aplicación no acepte.
   */
  async function createPlayers(count: number): Promise<string[]> {
    const dnis = Array.from({ length: count }, () => testDni());
    await prisma.player.createMany({
      data: dnis.map((dni, index) => ({
        dni,
        firstName: 'Jugador',
        lastName: `Bracket ${index + 1}`,
      })),
    });

    const players = await prisma.player.findMany({
      where: { dni: { in: dnis } },
      select: { id: true },
    });
    return players.map((player) => player.id);
  }

  /** Inscribe una dupla nueva (dos jugadores recién registrados) en el torneo. */
  async function createTeam(
    token: string,
    tournamentId: string,
    testCase: string,
  ): Promise<TeamResponseBody> {
    const playerA = await registerPlayer(`${testCase}-a`);
    const playerB = await registerPlayer(`${testCase}-b`);
    const response = await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/teams`)
      .set('Authorization', `Bearer ${token}`)
      .send({ player1Id: playerA.id, player2Id: playerB.id })
      .expect(201);

    return response.body as TeamResponseBody;
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
    // Orden inverso al de las FKs: `matches` referencia duplas con
    // `Restrict` —así que va antes que `teams`, o el borrado de duplas muere
    // contra la FK—, `teams` referencia torneo y club, `tournaments`
    // referencia club (`Restrict`), y `clubs`/`players` referencian `users`
    // (`Restrict`).
    //
    // Un solo `deleteMany` por club borra el árbol entero de partidos aunque
    // se apunten entre sí: `matches_next_match_id_fkey` es `NO ACTION`, que
    // en Postgres difiere el chequeo al final de la sentencia.
    for (const clubId of createdClubIds) {
      await prisma.match.deleteMany({ where: { clubId } });
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

      // El club nace en el plan `free`, que permite una sola llave activa:
      // el segundo torneo ya toca el techo.
      const first = await createTournament(club.token, 'quota-1');

      const overQuota = await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', `Bearer ${club.token}`)
        .send({ name: testTournamentName('quota-2') });

      expect(overQuota.status).toBe(409);
      const body = overQuota.body as ErrorBody;
      expect(body.code).toBe('tournament_quota_reached');
      expect(body.details).toEqual({ max: 1, current: 1 });

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
        .send({ name: testTournamentName('quota-3') });

      expect(afterCancel.status).toBe(201);
    });
  });

  describe('GET /tournaments (pagination)', () => {
    it('paginates by cursor without repeating or skipping items, and nextCursor is null on the last page', async () => {
      const club = await createClub('pagination');
      await raiseQuota(club.clubId, 3);
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

  describe('POST /tournaments/:tournamentId/bracket', () => {
    /**
     * Inscribe `count` duplas en un torneo nuevo y devuelve todo lo que hace
     * falta para generar el cuadro. Cada dupla son dos jugadores nuevos, así
     * que las etiquetas van sin dígitos: el fixture las usa como apellido y
     * `NAME_REGEX` no acepta números.
     */
    async function tournamentWithTeams(
      testCase: string,
      count: number,
    ): Promise<{
      token: string;
      tournamentId: string;
      teams: TeamResponseBody[];
    }> {
      const club = await createClub(testCase);
      const tournament = await createTournament(club.token, testCase);
      // Los jugadores van por Prisma (ver `createPlayers`); las duplas sí van
      // por la API, porque el orden canónico del par y el scoping por torneo
      // son parte de lo que el cuadro después consume.
      const playerIds = await createPlayers(count * 2);
      const teams: TeamResponseBody[] = [];
      for (let index = 0; index < count; index += 1) {
        const created = await request(app.getHttpServer())
          .post(`/tournaments/${tournament.id}/teams`)
          .set('Authorization', `Bearer ${club.token}`)
          .send({
            player1Id: playerIds[index * 2],
            player2Id: playerIds[index * 2 + 1],
          })
          .expect(201);
        teams.push(created.body as TeamResponseBody);
      }
      return { token: club.token, tournamentId: tournament.id, teams };
    }

    function seed(
      token: string,
      tournamentId: string,
      teamId: string,
      value: number,
    ) {
      return request(app.getHttpServer())
        .patch(`/tournaments/${tournamentId}/teams/${teamId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ seed: value })
        .expect(200);
    }

    function generate(token: string, tournamentId: string) {
      return request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/bracket`)
        .set('Authorization', `Bearer ${token}`);
    }

    /**
     * El sorteo es real (`cryptoShuffle`), así que estos tests fijan
     * **invariantes** y no una disposición exacta — mismo criterio que los
     * unit tests del generador. Un test que afirme "team-3 va en la posición
     * 2" acá sería un test que falla una vez cada tantas corridas.
     */
    it('201: materializes the whole tree, wired and connected', async () => {
      const { token, tournamentId } = await tournamentWithTeams('bracket', 4);

      const response = await generate(token, tournamentId);

      expect(response.status).toBe(201);
      const bracket = response.body as BracketResponseBody;
      expect(bracket.bracketSize).toBe(4);
      expect(bracket.roundCount).toBe(2);
      expect(bracket.byeCount).toBe(0);
      // S − 1 partidos, con las rondas futuras ya creadas y vacías.
      expect(bracket.matches).toHaveLength(3);

      const final = bracket.matches.filter((m) => m.nextMatchId === null);
      expect(final).toHaveLength(1);
      expect(final[0].round).toBe(2);
      expect(final[0].nextSlot).toBeNull();

      // Todo puntero apunta a un partido que existe de verdad: es lo que
      // prueba que el orden de inserción (de la final hacia atrás) satisface
      // la FK contra `matches`.
      const ids = new Set(bracket.matches.map((m) => m.id));
      for (const match of bracket.matches) {
        if (match.nextMatchId === null) continue;
        expect(ids.has(match.nextMatchId)).toBe(true);
        expect(['a', 'b']).toContain(match.nextSlot);
      }

      // La segunda ronda nace vacía esperando ganadores.
      const secondRound = bracket.matches.filter((m) => m.round === 2);
      expect(secondRound[0].teamA).toBeNull();
      expect(secondRound[0].teamB).toBeNull();
    });

    it('201: closes registration — the tournament goes to in_progress', async () => {
      const { token, tournamentId } = await tournamentWithTeams(
        'bracket-closes',
        2,
      );

      await generate(token, tournamentId).expect(201);

      const tournament = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((tournament.body as TournamentResponseBody).status).toBe(
        'in_progress',
      );

      // Y con la llave armada ya no entran ni salen duplas.
      const [lateA, lateB] = await createPlayers(2);
      const late = await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/teams`)
        .set('Authorization', `Bearer ${token}`)
        .send({ player1Id: lateA, player2Id: lateB });
      expect(late.status).toBe(409);
      expect((late.body as ErrorBody).code).toBe('tournament_not_open');
    });

    it('201: byes land on the seeded teams, and never against another bye', async () => {
      const { token, tournamentId, teams } = await tournamentWithTeams(
        'bracket-byes',
        6,
      );
      await seed(token, tournamentId, teams[0].id, 1);
      await seed(token, tournamentId, teams[1].id, 2);

      const response = await generate(token, tournamentId).expect(201);
      const bracket = response.body as BracketResponseBody;

      expect(bracket.bracketSize).toBe(8);
      expect(bracket.byeCount).toBe(2);

      const firstRound = bracket.matches.filter((m) => m.round === 1);
      const byes = firstRound.filter((m) => m.outcome === 'bye');
      expect(byes).toHaveLength(2);

      // Los dos byes son de las sembradas, y nacen cerrados con ganador.
      expect(byes.map((m) => m.teamA?.seed).sort()).toEqual([1, 2]);
      for (const bye of byes) {
        expect(bye.teamB).toBeNull();
        expect(bye.status).toBe('finished');
        expect(bye.winnerTeamId).toBe(bye.teamA?.id);
      }

      // Ningún partido de primera ronda con los dos lados vacíos.
      for (const match of firstRound) {
        expect(match.teamA).not.toBeNull();
      }

      // El ganador del bye ya está puesto en la segunda ronda.
      const secondRoundTeams = bracket.matches
        .filter((m) => m.round === 2)
        .flatMap((m) => [m.teamA?.id, m.teamB?.id])
        .filter((id): id is string => id !== undefined && id !== null);
      expect(secondRoundTeams.sort()).toEqual(
        byes.map((m) => m.teamA?.id).sort(),
      );
    });

    it('409 bracket_already_exists: generating twice does not redraw the bracket', async () => {
      const { token, tournamentId } = await tournamentWithTeams(
        'bracket-twice',
        2,
      );
      await generate(token, tournamentId).expect(201);

      const second = await generate(token, tournamentId);

      expect(second.status).toBe(409);
      expect((second.body as ErrorBody).code).toBe('bracket_already_exists');
    });

    it('409 not_enough_teams: a bracket needs at least two teams', async () => {
      const { token, tournamentId } = await tournamentWithTeams(
        'bracket-thin',
        1,
      );

      const response = await generate(token, tournamentId);

      expect(response.status).toBe(409);
      expect((response.body as ErrorBody).code).toBe('not_enough_teams');
      expect((response.body as ErrorBody).details).toMatchObject({
        teamCount: 1,
      });
    });

    it('409 invalid_seeding: seeds with a gap are the club to fix, not the API to guess', async () => {
      const { token, tournamentId, teams } = await tournamentWithTeams(
        'bracket-gap',
        4,
      );
      await seed(token, tournamentId, teams[0].id, 1);
      await seed(token, tournamentId, teams[1].id, 3);

      const response = await generate(token, tournamentId);

      expect(response.status).toBe(409);
      expect((response.body as ErrorBody).code).toBe('invalid_seeding');
      expect((response.body as ErrorBody).details).toEqual({ seeds: [1, 3] });

      // Y el torneo sigue abierto: la transacción se deshizo entera, no dejó
      // el torneo arrancado sin cuadro.
      const tournament = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((tournament.body as TournamentResponseBody).status).toBe('open');
    });

    it('never exposes a dni through the bracket', async () => {
      const { token, tournamentId } = await tournamentWithTeams(
        'bracket-no-dni',
        2,
      );

      const response = await generate(token, tournamentId).expect(201);

      const raw = JSON.stringify(response.body);
      for (const dni of createdDnis) {
        expect(raw).not.toContain(dni);
      }
      expect(raw).not.toContain('clubId');
    });

    it('404 tournament_not_found: another club cannot generate a bracket it does not own', async () => {
      const { tournamentId } = await tournamentWithTeams('bracket-tenancy', 2);
      const clubB = await createClub('bracket-tenancy-other');

      const response = await generate(clubB.token, tournamentId);

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).code).toBe('tournament_not_found');
    });
  });

  describe('PATCH /tournaments/:tournamentId/teams/:teamId', () => {
    it('200: seeds a team, and the seed comes back in the list', async () => {
      const club = await createClub('seed');
      const tournament = await createTournament(club.token, 'seed');
      const team = await createTeam(club.token, tournament.id, 'seed');

      expect(team.seed).toBeNull();

      const response = await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}/teams/${team.id}`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ seed: 1 })
        .expect(200);

      expect((response.body as TeamResponseBody).seed).toBe(1);

      const list = await request(app.getHttpServer())
        .get(`/tournaments/${tournament.id}/teams`)
        .set('Authorization', `Bearer ${club.token}`)
        .expect(200);
      expect((list.body as TeamResponseBody[])[0].seed).toBe(1);
    });

    /**
     * Este test y el siguiente son el par que sostiene el contrato: un `null`
     * explícito desiembra y un campo ausente no toca nada. Se prueban por
     * HTTP y no en el service porque lo que se está fijando es que el
     * `ValidationPipe` y `class-transformer` conserven esa diferencia — un
     * `@IsOptional()` mal puesto, o un `whitelist` que se coma el `null`,
     * colapsaría los dos casos en uno y el service nunca se enteraría.
     */
    it('200: an explicit null unseeds the team', async () => {
      const club = await createClub('unseed');
      const tournament = await createTournament(club.token, 'unseed');
      const team = await createTeam(club.token, tournament.id, 'unseed');

      await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}/teams/${team.id}`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ seed: 2 })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}/teams/${team.id}`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ seed: null })
        .expect(200);

      expect((response.body as TeamResponseBody).seed).toBeNull();
    });

    it('200: an empty body leaves the seed untouched', async () => {
      const club = await createClub('seed-noop');
      const tournament = await createTournament(club.token, 'seed-noop');
      const team = await createTeam(club.token, tournament.id, 'seed-noop');

      await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}/teams/${team.id}`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ seed: 3 })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}/teams/${team.id}`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({})
        .expect(200);

      expect((response.body as TeamResponseBody).seed).toBe(3);
    });

    it('409 duplicate_seed: two teams cannot share a seed in the same tournament', async () => {
      const club = await createClub('dup-seed');
      await raiseQuota(club.clubId, 5);
      const tournament = await createTournament(club.token, 'dup-seed');
      const first = await createTeam(club.token, tournament.id, 'dup-seed-one');
      const second = await createTeam(
        club.token,
        tournament.id,
        'dup-seed-two',
      );

      await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}/teams/${first.id}`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ seed: 1 })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}/teams/${second.id}`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ seed: 1 });

      expect(response.status).toBe(409);
      expect((response.body as ErrorBody).code).toBe('duplicate_seed');
      expect((response.body as ErrorBody).details).toEqual({ seed: 1 });
    });

    // Varias duplas sin sembrar es el caso normal, no una excepción: los NULL
    // no colisionan entre sí en el índice único.
    it('200: any number of teams can stay unseeded at the same time', async () => {
      const club = await createClub('many-null');
      const tournament = await createTournament(club.token, 'many-null');
      const first = await createTeam(
        club.token,
        tournament.id,
        'many-null-one',
      );
      const second = await createTeam(
        club.token,
        tournament.id,
        'many-null-two',
      );

      for (const team of [first, second]) {
        await request(app.getHttpServer())
          .patch(`/tournaments/${tournament.id}/teams/${team.id}`)
          .set('Authorization', `Bearer ${club.token}`)
          .send({ seed: null })
          .expect(200);
      }
    });

    // La etiqueta va aparte del número y sin dígitos a propósito: el fixture
    // usa el nombre del caso como apellido del jugador, y `NAME_REGEX` no
    // acepta números.
    it.each([
      [0, 'zero'],
      [-1, 'negative'],
      [1.5, 'fractional'],
      [999, 'over-max'],
    ])('400 validation: rejects a seed of %p (%s)', async (seed, label) => {
      const club = await createClub(`bad-seed-${label}`);
      const tournament = await createTournament(
        club.token,
        `bad-seed-${label}`,
      );
      const team = await createTeam(
        club.token,
        tournament.id,
        `bad-seed-${label}`,
      );

      const response = await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}/teams/${team.id}`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ seed });

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).code).toBe('validation');
    });

    it('409 tournament_not_open: seeding stops once the tournament is no longer open', async () => {
      const club = await createClub('seed-closed');
      const tournament = await createTournament(club.token, 'seed-closed');
      const team = await createTeam(club.token, tournament.id, 'seed-closed');

      await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ status: 'canceled' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}/teams/${team.id}`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ seed: 1 });

      expect(response.status).toBe(409);
      expect((response.body as ErrorBody).code).toBe('tournament_not_open');
    });

    it('404 team_not_found: the team does not exist in that tournament', async () => {
      const club = await createClub('seed-missing');
      const tournament = await createTournament(club.token, 'seed-missing');

      const response = await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}/teams/${randomUUID()}`)
        .set('Authorization', `Bearer ${club.token}`)
        .send({ seed: 1 });

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).code).toBe('team_not_found');
    });

    it('404 tournament_not_found: another club cannot seed a team it does not own', async () => {
      const clubA = await createClub('seed-tenancy-a');
      const clubB = await createClub('seed-tenancy-b');
      const tournament = await createTournament(clubA.token, 'seed-tenancy');
      const team = await createTeam(clubA.token, tournament.id, 'seed-tenancy');

      const response = await request(app.getHttpServer())
        .patch(`/tournaments/${tournament.id}/teams/${team.id}`)
        .set('Authorization', `Bearer ${clubB.token}`)
        .send({ seed: 1 });

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).code).toBe('tournament_not_found');
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

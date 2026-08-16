import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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

describe('GET /health (e2e)', () => {
  describe('with a reachable database', () => {
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

    it('returns 200 with the database reported as up', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({ status: 'ok', database: 'up' });
    });
  });

  describe('with an unreachable database', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      // Se sustituye `PrismaService` en vez de apagar Postgres: es la
      // única forma de cubrir el camino de fallo en una suite que corre
      // contra una base real, en local y en CI.
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(PrismaService)
        .useValue({
          $queryRaw: jest
            .fn()
            .mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432')),
        })
        .compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns 503 with the uniform error shape', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(503);

      const body = response.body as ErrorBody;
      expect(body).toEqual({
        statusCode: 503,
        code: 'database_unavailable',
        message: 'the database is not reachable',
        details: null,
      });
    });
  });
});

import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PrismaService (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `prisma-e2e-${randomUUID()}@dupla.test`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('escribe y lee un registro real contra Postgres', async () => {
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash: 'irrelevant-for-this-test',
      },
    });

    expect(created.id).toEqual(expect.any(String));
    expect(created.status).toBe('active');

    const found = await prisma.user.findUnique({ where: { email } });
    expect(found?.id).toBe(created.id);
  });
});

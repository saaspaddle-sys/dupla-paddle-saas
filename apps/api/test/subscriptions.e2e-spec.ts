import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MERCADO_PAGO_PREAPPROVAL_CLIENT } from '../src/subscriptions/mercado-pago-preapproval.client';
import type { MercadoPagoPreapprovalClient } from '../src/subscriptions/mercado-pago-preapproval.client';
import { ProviderUnavailableError } from '../src/subscriptions/mercado-pago-preapproval.client';
import { MERCADO_PAGO_WEBHOOK_VERIFIER } from '../src/subscriptions/mercado-pago-webhook-verifier';
import type { MercadoPagoWebhookVerifier } from '../src/subscriptions/mercado-pago-webhook-verifier';

interface AuthBody {
  accessToken: string;
}
interface SubscriptionBody {
  plan: string;
  status: string;
  maxTournaments: number;
}
interface CheckoutBody {
  plan: string;
  reference: string;
  checkoutUrl: string;
  reused: boolean;
}
interface ErrorBody {
  code: string;
}

describe('Subscriptions checkout (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let noClubToken: string;
  let ownerId: string;
  const suffix = randomUUID().slice(0, 8);
  const ownerEmail = `billing-owner-${suffix}@dupla.test`;
  const noClubEmail = `billing-no-club-${suffix}@dupla.test`;
  const provider: jest.Mocked<MercadoPagoPreapprovalClient> = {
    create: jest.fn(),
    getAuthorizedPayment: jest.fn(),
  };
  const verifier: jest.Mocked<MercadoPagoWebhookVerifier> = {
    verify: jest.fn().mockReturnValue(true),
  };

  beforeAll(async () => {
    process.env.MERCADO_PAGO_BASIC_AMOUNT = '100';
    process.env.MERCADO_PAGO_PRO_AMOUNT = '200';
    process.env.MERCADO_PAGO_CURRENCY = 'ARS';
    process.env.MERCADO_PAGO_BACK_URL = 'https://app.test/billing-return';
    process.env.MERCADO_PAGO_WEBHOOK_URL =
      'https://api.test/webhooks/mercado-pago';
    provider.create.mockResolvedValue({
      id: `preapproval-${suffix}`,
      status: 'pending',
      initPoint: `https://checkout.test/${suffix}`,
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(MERCADO_PAGO_PREAPPROVAL_CLIENT)
      .useValue(provider)
      .overrideProvider(MERCADO_PAGO_WEBHOOK_VERIFIER)
      .useValue(verifier)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    for (const [email, dni] of [
      [ownerEmail, `7${suffix.replace(/[^0-9]/g, '0').slice(0, 7)}`],
      [noClubEmail, `6${suffix.replace(/[^0-9]/g, '1').slice(0, 7)}`],
    ] as const) {
      const register = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'password123',
          dni,
          firstName: 'Billing',
          lastName: 'Tester',
        });
      expect(register.status).toBe(201);
    }
    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ownerEmail, password: 'password123' });
    token = (ownerLogin.body as AuthBody).accessToken;
    const noClubLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: noClubEmail, password: 'password123' });
    noClubToken = (noClubLogin.body as AuthBody).accessToken;
    const club = await request(app.getHttpServer())
      .post('/clubs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Billing Club ${suffix}` });
    expect(club.status).toBe(201);
    ownerId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: ownerEmail },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.club.deleteMany({ where: { ownerId } });
    await prisma.player.deleteMany({ where: { dni: { startsWith: '6' } } });
    await prisma.player.deleteMany({ where: { dni: { startsWith: '7' } } });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, noClubEmail] } },
    });
    await app.close();
  });

  it('enforces authentication and club scope for subscription routes', async () => {
    expect(
      (await request(app.getHttpServer()).get('/subscriptions/me')).status,
    ).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .get('/subscriptions/me')
          .set('Authorization', `Bearer ${noClubToken}`)
      ).status,
    ).toBe(403);
  });

  it('returns and preserves the free effective entitlement while checkout is pending', async () => {
    const before = await request(app.getHttpServer())
      .get('/subscriptions/me')
      .set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);
    expect(before.body as SubscriptionBody).toMatchObject({
      plan: 'free',
      status: 'active',
      maxTournaments: 1,
    });
    const checkout = await request(app.getHttpServer())
      .post('/subscriptions/me/checkouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'basic' });
    expect(checkout.status).toBe(201);
    expect(checkout.body as CheckoutBody).toMatchObject({
      plan: 'basic',
      checkoutUrl: `https://checkout.test/${suffix}`,
      reused: false,
    });
    const after = await request(app.getHttpServer())
      .get('/subscriptions/me')
      .set('Authorization', `Bearer ${token}`);
    expect(after.body as SubscriptionBody).toEqual(
      before.body as SubscriptionBody,
    );
  });

  it('rejects free checkout, reuses the same plan and rejects a plan change', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/subscriptions/me/checkouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'free' });
    expect(invalid.status).toBe(400);
    const reused = await request(app.getHttpServer())
      .post('/subscriptions/me/checkouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'basic' });
    expect(reused.status).toBe(201);
    expect((reused.body as CheckoutBody).reused).toBe(true);
    const conflict = await request(app.getHttpServer())
      .post('/subscriptions/me/checkouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'pro' });
    expect(conflict.status).toBe(409);
    expect((conflict.body as ErrorBody).code).toBe(
      'checkout_pending_for_another_plan',
    );
  });

  it('processes only canonical approved charges idempotently without JWT', async () => {
    const checkout = await prisma.subscriptionCheckout.findFirstOrThrow({
      where: { providerPreapprovalId: `preapproval-${suffix}` },
      select: { id: true, reference: true },
    });
    const eventId = `event-approved-${suffix}`;
    provider.getAuthorizedPayment.mockResolvedValue({
      id: `payment-approved-${suffix}`,
      status: 'approved',
      preapprovalId: `preapproval-${suffix}`,
      amount: 100,
      currencyId: 'ARS',
      externalReference: checkout.reference,
    });
    const payload = {
      id: eventId,
      type: 'subscription_authorized_payment',
      data: { id: `payment-approved-${suffix}` },
    };
    const first = await request(app.getHttpServer())
      .post('/webhooks/mercado-pago')
      .set('x-signature', 'test-signature')
      .set('x-request-id', `request-${suffix}`)
      .send(payload);
    const replay = await request(app.getHttpServer())
      .post('/webhooks/mercado-pago')
      .set('x-signature', 'test-signature')
      .set('x-request-id', `request-${suffix}`)
      .send(payload);
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(
      await prisma.paymentEvent.count({ where: { externalId: eventId } }),
    ).toBe(1);
    expect(
      await prisma.subscriptionCheckout.findUniqueOrThrow({
        where: { id: checkout.id },
        select: { state: true },
      }),
    ).toEqual({ state: 'completed' });
    expect(
      await prisma.subscription.findUniqueOrThrow({
        where: { userId: ownerId },
        select: { plan: true, status: true, maxTournaments: true },
      }),
    ).toEqual({ plan: 'basic', status: 'active', maxTournaments: 3 });
  });

  it('writes nothing for invalid signatures or malformed bodies', async () => {
    const before = await prisma.paymentEvent.count();
    verifier.verify.mockReturnValueOnce(false);
    const invalid = await request(app.getHttpServer())
      .post('/webhooks/mercado-pago')
      .set('x-signature', 'invalid')
      .set('x-request-id', `invalid-${suffix}`)
      .send({
        id: `invalid-${suffix}`,
        type: 'subscription_authorized_payment',
        data: { id: 'x' },
      });
    const malformed = await request(app.getHttpServer())
      .post('/webhooks/mercado-pago')
      .set('x-signature', 'test-signature')
      .set('x-request-id', `malformed-${suffix}`)
      .send({
        id: `malformed-${suffix}`,
        type: 'subscription_authorized_payment',
        data: {},
      });
    expect(invalid.status).toBe(401);
    expect(malformed.status).toBe(400);
    expect(await prisma.paymentEvent.count()).toBe(before);
  });

  it('does not activate mismatched or non-approved canonical charges', async () => {
    const subscription = await prisma.subscription.findUniqueOrThrow({
      where: { userId: ownerId },
      select: { id: true },
    });
    await prisma.subscriptionCheckout.create({
      data: {
        subscriptionId: subscription.id,
        reference: `mismatch-${suffix}`,
        targetPlan: 'pro',
        amount: 200,
        currency: 'ARS',
        state: 'pending',
        providerPreapprovalId: `mismatch-preapproval-${suffix}`,
      },
    });
    provider.getAuthorizedPayment.mockResolvedValueOnce({
      id: `payment-mismatch-${suffix}`,
      status: 'approved',
      preapprovalId: `mismatch-preapproval-${suffix}`,
      amount: 199,
      currencyId: 'ARS',
      externalReference: `mismatch-${suffix}`,
    });
    provider.getAuthorizedPayment.mockResolvedValueOnce({
      id: `payment-pending-${suffix}`,
      status: 'pending',
      preapprovalId: `mismatch-preapproval-${suffix}`,
      amount: 200,
      currencyId: 'ARS',
      externalReference: `mismatch-${suffix}`,
    });
    provider.getAuthorizedPayment.mockResolvedValueOnce({
      id: `payment-reference-mismatch-${suffix}`,
      status: 'approved',
      preapprovalId: `mismatch-preapproval-${suffix}`,
      amount: 200,
      currencyId: 'ARS',
      externalReference: `other-reference-${suffix}`,
    });
    for (const [id, resource] of [
      [`mismatch-event-${suffix}`, `payment-mismatch-${suffix}`],
      [`pending-event-${suffix}`, `payment-pending-${suffix}`],
      [
        `reference-mismatch-event-${suffix}`,
        `payment-reference-mismatch-${suffix}`,
      ],
    ]) {
      expect(
        (
          await request(app.getHttpServer())
            .post('/webhooks/mercado-pago')
            .set('x-signature', 'test')
            .set('x-request-id', id)
            .send({
              id,
              type: 'subscription_authorized_payment',
              data: { id: resource },
            })
        ).status,
      ).toBe(200);
    }
    expect(
      await prisma.subscription.findUniqueOrThrow({
        where: { userId: ownerId },
        select: { plan: true, maxTournaments: true },
      }),
    ).toEqual({ plan: 'basic', maxTournaments: 3 });
    await prisma.subscriptionCheckout.updateMany({
      where: {
        subscriptionId: subscription.id,
        providerPreapprovalId: `mismatch-preapproval-${suffix}`,
      },
      data: { state: 'expired' },
    });
    provider.getAuthorizedPayment.mockResolvedValueOnce({
      id: `payment-expired-${suffix}`,
      status: 'approved',
      preapprovalId: `mismatch-preapproval-${suffix}`,
      amount: 200,
      currencyId: 'ARS',
      externalReference: `mismatch-${suffix}`,
    });
    expect(
      (
        await request(app.getHttpServer())
          .post('/webhooks/mercado-pago')
          .set('x-signature', 'test')
          .set('x-request-id', `expired-event-${suffix}`)
          .send({
            id: `expired-event-${suffix}`,
            type: 'subscription_authorized_payment',
            data: { id: `payment-expired-${suffix}` },
          })
      ).status,
    ).toBe(200);
    expect(
      await prisma.subscription.findUniqueOrThrow({
        where: { userId: ownerId },
        select: { plan: true, maxTournaments: true },
      }),
    ).toEqual({ plan: 'basic', maxTournaments: 3 });
  });

  it('resumes an inserted event and serializes concurrent duplicate delivery', async () => {
    const subscription = await prisma.subscription.findUniqueOrThrow({
      where: { userId: ownerId },
      select: { id: true },
    });
    await prisma.subscriptionCheckout.create({
      data: {
        subscriptionId: subscription.id,
        reference: `recovery-${suffix}`,
        targetPlan: 'pro',
        amount: 200,
        currency: 'ARS',
        state: 'pending',
        providerPreapprovalId: `recovery-preapproval-${suffix}`,
      },
    });
    const recoveryEvent = `recovery-event-${suffix}`;
    provider.getAuthorizedPayment.mockRejectedValueOnce(
      new ProviderUnavailableError(),
    );
    const interrupted = await request(app.getHttpServer())
      .post('/webhooks/mercado-pago')
      .set('x-signature', 'test')
      .set('x-request-id', recoveryEvent)
      .send({
        id: recoveryEvent,
        type: 'subscription_authorized_payment',
        data: { id: `recovery-payment-${suffix}` },
      });
    expect(interrupted.status).toBe(503);
    expect(
      await prisma.paymentEvent.findUniqueOrThrow({
        where: {
          provider_externalId: {
            provider: 'mercado_pago',
            externalId: recoveryEvent,
          },
        },
        select: { processedAt: true },
      }),
    ).toEqual({ processedAt: null });
    provider.getAuthorizedPayment.mockResolvedValueOnce({
      id: `recovery-payment-${suffix}`,
      status: 'approved',
      preapprovalId: `recovery-preapproval-${suffix}`,
      amount: 200,
      currencyId: 'ARS',
      externalReference: `recovery-${suffix}`,
    });
    expect(
      (
        await request(app.getHttpServer())
          .post('/webhooks/mercado-pago')
          .set('x-signature', 'test')
          .set('x-request-id', recoveryEvent)
          .send({
            id: recoveryEvent,
            type: 'subscription_authorized_payment',
            data: { id: `recovery-payment-${suffix}` },
          })
      ).status,
    ).toBe(200);
    expect(
      await prisma.subscription.findUniqueOrThrow({
        where: { userId: ownerId },
        select: { plan: true, maxTournaments: true },
      }),
    ).toEqual({ plan: 'pro', maxTournaments: 12 });

    await prisma.subscriptionCheckout.create({
      data: {
        subscriptionId: subscription.id,
        reference: `concurrent-${suffix}`,
        targetPlan: 'basic',
        amount: 100,
        currency: 'ARS',
        state: 'pending',
        providerPreapprovalId: `concurrent-preapproval-${suffix}`,
      },
    });
    const eventId = `concurrent-event-${suffix}`;
    provider.getAuthorizedPayment.mockResolvedValue({
      id: `concurrent-payment-${suffix}`,
      status: 'approved',
      preapprovalId: `concurrent-preapproval-${suffix}`,
      amount: 100,
      currencyId: 'ARS',
      externalReference: `concurrent-${suffix}`,
    });
    const delivery = () =>
      request(app.getHttpServer())
        .post('/webhooks/mercado-pago')
        .set('x-signature', 'test')
        .set('x-request-id', eventId)
        .send({
          id: eventId,
          type: 'subscription_authorized_payment',
          data: { id: `concurrent-payment-${suffix}` },
        });
    const [one, two] = await Promise.all([delivery(), delivery()]);
    expect([one.status, two.status]).toEqual([200, 200]);
    expect(
      await prisma.paymentEvent.count({ where: { externalId: eventId } }),
    ).toBe(1);
    expect(
      await prisma.subscription.findUniqueOrThrow({
        where: { userId: ownerId },
        select: { plan: true, maxTournaments: true },
      }),
    ).toEqual({ plan: 'basic', maxTournaments: 3 });
  });

  it('preserves checkout correlation when the provider outcome is ambiguous', async () => {
    const subscription = await prisma.subscription.findUniqueOrThrow({
      where: { userId: ownerId },
      select: { id: true },
    });
    await prisma.subscriptionCheckout.deleteMany({
      where: { subscriptionId: subscription.id },
    });
    provider.create.mockRejectedValueOnce(new Error('transport timeout'));
    const failed = await request(app.getHttpServer())
      .post('/subscriptions/me/checkouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'basic' });
    expect(failed.status).toBe(503);
    expect((failed.body as ErrorBody).code).toBe(
      'billing_checkout_recovery_required',
    );
    expect(
      await prisma.subscriptionCheckout.count({
        where: { subscriptionId: subscription.id },
      }),
    ).toBe(1);
    const reservation = await prisma.subscriptionCheckout.findFirstOrThrow({
      where: { subscriptionId: subscription.id },
      select: { reference: true, state: true, providerPreapprovalId: true },
    });
    expect(reservation.reference).toEqual(expect.any(String));
    expect(reservation.state).toBe('recovery_required');
    expect(reservation.providerPreapprovalId).toBeNull();
    const retry = await request(app.getHttpServer())
      .post('/subscriptions/me/checkouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'basic' });
    expect(retry.status).toBe(503);
    expect((retry.body as ErrorBody).code).toBe(
      'billing_checkout_recovery_required',
    );
    expect(provider.create.mock.calls).toHaveLength(2);
  });

  it('treats a legacy zero-term reservation as expired so it cannot activate or block a fresh checkout', async () => {
    const subscription = await prisma.subscription.findUniqueOrThrow({
      where: { userId: ownerId },
      select: { id: true },
    });
    await prisma.subscriptionCheckout.deleteMany({
      where: { subscriptionId: subscription.id },
    });
    await prisma.subscriptionCheckout.create({
      data: {
        subscriptionId: subscription.id,
        reference: `legacy-${suffix}`,
        targetPlan: 'pro',
        amount: 0,
        currency: '',
        state: 'expired',
        providerPreapprovalId: `legacy-preapproval-${suffix}`,
      },
    });
    provider.getAuthorizedPayment.mockResolvedValueOnce({
      id: `legacy-payment-${suffix}`,
      status: 'approved',
      preapprovalId: `legacy-preapproval-${suffix}`,
      amount: 0,
      currencyId: '',
      externalReference: `legacy-${suffix}`,
    });
    expect(
      (
        await request(app.getHttpServer())
          .post('/webhooks/mercado-pago')
          .set('x-signature', 'test')
          .set('x-request-id', `legacy-event-${suffix}`)
          .send({
            id: `legacy-event-${suffix}`,
            type: 'subscription_authorized_payment',
            data: { id: `legacy-payment-${suffix}` },
          })
      ).status,
    ).toBe(200);
    expect(
      await prisma.subscription.findUniqueOrThrow({
        where: { userId: ownerId },
        select: { plan: true, maxTournaments: true },
      }),
    ).toEqual({ plan: 'basic', maxTournaments: 3 });
    const fresh = await request(app.getHttpServer())
      .post('/subscriptions/me/checkouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'basic' });
    expect(fresh.status).toBe(201);
  });
});

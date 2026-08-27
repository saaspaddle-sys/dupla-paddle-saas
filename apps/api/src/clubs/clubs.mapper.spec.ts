import { ClubModel, SubscriptionModel } from '../generated/prisma/models';
import { toClubResponse } from './clubs.mapper';

function createClub(overrides: Partial<ClubModel> = {}): ClubModel {
  return {
    id: 'club-1',
    ownerId: 'user-1',
    name: 'Club Ñandú',
    slug: 'club-nandu',
    status: 'active',
    createdAt: new Date('2026-08-24T12:00:00.000Z'),
    updatedAt: new Date('2026-08-24T12:00:00.000Z'),
    ...overrides,
  };
}

function createSubscription(
  overrides: Partial<SubscriptionModel> = {},
): SubscriptionModel {
  return {
    id: 'subscription-1',
    userId: 'user-1',
    plan: 'basic',
    status: 'pending',
    maxTournaments: 3,
    createdAt: new Date('2026-08-24T12:00:00.000Z'),
    updatedAt: new Date('2026-08-24T12:00:00.000Z'),
    ...overrides,
  };
}

describe('toClubResponse', () => {
  it('maps the club and its subscription into the response shape', () => {
    const response = toClubResponse(createClub(), createSubscription());

    expect(response).toEqual({
      id: 'club-1',
      name: 'Club Ñandú',
      slug: 'club-nandu',
      status: 'active',
      createdAt: '2026-08-24T12:00:00.000Z',
      updatedAt: '2026-08-24T12:00:00.000Z',
      subscription: { plan: 'basic', status: 'pending', maxTournaments: 3 },
    });
  });

  // La razón por la que este mapper es manual y no un
  // `ClassSerializerInterceptor`: el enfoque fail-open dejaría salir
  // `owner_id` en cuanto nadie se acuerde de excluirlo.
  it('never leaks the owner id', () => {
    const response = toClubResponse(createClub(), createSubscription());

    expect(response).not.toHaveProperty('ownerId');
    expect(JSON.stringify(response)).not.toContain('user-1');
  });

  // Ídem con los campos administrativos de billing: no hay consumidor.
  it('never leaks the subscription id or its timestamps', () => {
    const response = toClubResponse(createClub(), createSubscription());

    expect(response.subscription).toEqual({
      plan: 'basic',
      status: 'pending',
      maxTournaments: 3,
    });
  });

  it('serializes timestamps as ISO 8601 strings', () => {
    const response = toClubResponse(createClub(), createSubscription());

    expect(typeof response.createdAt).toBe('string');
    expect(typeof response.updatedAt).toBe('string');
  });
});

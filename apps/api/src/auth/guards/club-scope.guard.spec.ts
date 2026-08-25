import { ExecutionContext } from '@nestjs/common';
import { ClubScopeGuard, RequestWithClubScope } from './club-scope.guard';
import { AuthenticatedUser } from '../types/authenticated-user';

function createContext(request: RequestWithClubScope): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function userWithClub(): AuthenticatedUser {
  return {
    id: 'user-1',
    email: 'juan@example.com',
    player: null,
    club: {
      id: 'club-1',
      name: 'Club Ñandú',
      slug: 'club-nandu',
      status: 'active',
    },
  };
}

/**
 * `expect(fn).toThrow(expect.objectContaining(...))` pasa un `any` al
 * matcher y el lint lo marca (`no-unsafe-argument`, warning local pero
 * error en CI). Capturar el error y afirmar sobre él con `toMatchObject`
 * dice lo mismo sin castear nada.
 */
function captureError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('expected the guard to throw, but it returned');
}

describe('ClubScopeGuard', () => {
  let guard: ClubScopeGuard;

  beforeEach(() => {
    guard = new ClubScopeGuard();
  });

  it('puts the club id of the authenticated user on the request', () => {
    const request: RequestWithClubScope = { user: userWithClub() };

    expect(guard.canActivate(createContext(request))).toBe(true);
    expect(request.clubId).toBe('club-1');
  });

  it('rejects with 403 club_required when the account owns no club', () => {
    const request: RequestWithClubScope = {
      user: { ...userWithClub(), club: null },
    };

    const error = captureError(() => guard.canActivate(createContext(request)));

    expect(error).toMatchObject({
      status: 403,
      response: { code: 'club_required' },
    });
    expect(request.clubId).toBeUndefined();
  });

  // El caso "alguien puso ClubScopeGuard sin JwtAuthGuard adelante": tiene
  // que fallar cerrado, no dejar pasar un request sin scope.
  it('rejects with 401 unauthenticated when there is no user on the request', () => {
    const request: RequestWithClubScope = {};

    const error = captureError(() => guard.canActivate(createContext(request)));

    expect(error).toMatchObject({
      status: 401,
      response: { code: 'unauthenticated' },
    });
    expect(request.clubId).toBeUndefined();
  });

  // La razón de ser del guard: el scope sale del usuario, nunca del
  // request. Si alguien manda `clubId` a mano, el guard lo pisa.
  it('overwrites a clubId planted on the request by the client', () => {
    const request: RequestWithClubScope = {
      user: userWithClub(),
      clubId: 'club-de-otro',
    };

    guard.canActivate(createContext(request));

    expect(request.clubId).toBe('club-1');
  });
});

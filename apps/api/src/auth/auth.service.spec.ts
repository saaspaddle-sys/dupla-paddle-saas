import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  user: { findUnique: jest.Mock };
};

function createDto(overrides: Partial<LoginDto> = {}): LoginDto {
  const dto = new LoginDto();
  Object.assign(dto, {
    email: 'juan@example.com',
    password: 'password123',
    ...overrides,
  });
  return dto;
}

function createUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'juan@example.com',
    passwordHash: bcrypt.hashSync('password123', 4),
    status: 'active',
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let jwtService: { signAsync: jest.Mock };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns an access token when the credentials are correct', async () => {
    prisma.user.findUnique.mockResolvedValue(createUser());

    const result = await service.login(createDto());

    expect(result).toEqual({
      accessToken: 'signed.jwt.token',
      tokenType: 'Bearer',
      expiresIn: 60 * 60 * 24 * 7,
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-1' });
  });

  it('normalizes the email before looking up the user', async () => {
    prisma.user.findUnique.mockResolvedValue(createUser());

    await service.login(createDto({ email: '  JUAN@Example.COM  ' }));

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'juan@example.com' },
    });
  });

  describe('when the credentials are wrong', () => {
    it('rejects with 401 invalid_credentials when the email does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(createDto())).rejects.toMatchObject({
        status: 401,
        response: expect.objectContaining({
          code: 'invalid_credentials',
          message: 'invalid email or password',
        }) as unknown,
      });
    });

    it('rejects with the exact same 401 invalid_credentials when the password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(createUser());

      await expect(
        service.login(createDto({ password: 'wrong-password' })),
      ).rejects.toMatchObject({
        status: 401,
        response: expect.objectContaining({
          code: 'invalid_credentials',
          message: 'invalid email or password',
        }) as unknown,
      });
    });

    it('never signs a token when the credentials are wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.login(createDto()).catch(() => undefined);

      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  it('rejects with 403 account_suspended only after the password checks out', async () => {
    prisma.user.findUnique.mockResolvedValue(
      createUser({ status: 'suspended' }),
    );

    await expect(service.login(createDto())).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'account_suspended',
      }) as unknown,
    });

    // Con la contraseña mal, el estado suspendido no debe filtrarse: tiene
    // que dar el mismo invalid_credentials que cualquier otra combinación
    // errónea, no un 403 que confirme que el email existe.
    await expect(
      service.login(createDto({ password: 'wrong-password' })),
    ).rejects.toMatchObject({
      status: 401,
      response: expect.objectContaining({
        code: 'invalid_credentials',
      }) as unknown,
    });
  });

  it('runs bcrypt.compare against a dummy hash when the email does not exist (anti-timing)', async () => {
    const compareSpy = jest.spyOn(bcrypt, 'compare');
    prisma.user.findUnique.mockResolvedValue(null);

    await service.login(createDto()).catch(() => undefined);

    expect(compareSpy).toHaveBeenCalledTimes(1);
    const [, hashArgument] = compareSpy.mock.calls[0] as [string, string];
    const dummyHash = (service as unknown as { dummyHash: string }).dummyHash;
    expect(hashArgument).toBe(dummyHash);
  });
});

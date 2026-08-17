import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { ACCESS_TOKEN_TTL_SECONDS, AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    // No es @Global(): igual que PlayersModule, cada módulo que necesite
    // Prisma lo importa explícitamente.
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // `getOrThrow` hace que un `JWT_SECRET` faltante tumbe el boot del
        // proceso, no el primer request que necesite firmar o validar un
        // token — falla rápido y en un lugar obvio (los e2e no arrancan).
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // `PassportModule` para que el futuro guard de club (mismo esquema JWT)
  // no tenga que repetir el registro — ver el error de Nest si un
  // `AuthGuard()` se usa sin `PassportModule` importado en ese módulo.
  exports: [PassportModule],
})
export class AuthModule {}

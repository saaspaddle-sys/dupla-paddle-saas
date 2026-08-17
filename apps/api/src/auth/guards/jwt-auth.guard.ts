import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * `'jwt'` es el `defaultStrategy` registrado en `AuthModule`
 * (`PassportModule.register`), así que no hace falta repetirlo acá.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Una query trivial, que es la única forma de saberlo: el pool de `pg`
   * del driver adapter es lazy y no abre socket hasta la primera query,
   * así que el `$connect()` de `PrismaService.onModuleInit` no prueba
   * nada. Sin esto, "el proceso arrancó" y "la API puede trabajar" son
   * dos cosas distintas que nadie distingue hasta el primer request real
   * (ver `docs/database.md`).
   */
  async isDatabaseReachable(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      // El filtro global va a loguear la excepción del controller, que ya
      // no tiene adentro la causa real (un ECONNREFUSED, credenciales
      // mal, la base caída): o se loguea acá, o se pierde.
      this.logger.error(error instanceof Error ? error.stack : String(error));
      return false;
    }
  }
}

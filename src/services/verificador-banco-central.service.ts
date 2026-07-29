import type { PrismaClient } from '../generated/prisma/client.js';
import type { VerificadorDependencia } from './prontidao.service.js';

export class VerificadorBancoCentralService implements VerificadorDependencia {
  public readonly nome = 'postgresql-central';

  public constructor(private readonly prisma: PrismaClient) {}

  public async verificar(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}

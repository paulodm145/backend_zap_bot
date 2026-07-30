import type { PrismaClient } from '../generated/prisma-tenant/client.js';

export class SetorRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async buscarPublicIdsAtivos(publicIds: string[]): Promise<Set<string>> {
    const setores = await this.prisma.setor.findMany({
      where: {
        public_id: { in: publicIds },
        ativo: true,
      },
      select: { public_id: true },
    });
    return new Set(setores.map((setor) => setor.public_id));
  }
}

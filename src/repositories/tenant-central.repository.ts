import type { PrismaClient, StatusTenant } from '../generated/prisma/client.js';

export interface CriarTenantCentral {
  nome: string;
  status?: StatusTenant;
}

export class TenantCentralRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async criar(entrada: CriarTenantCentral) {
    return this.prisma.tenant.create({
      data: {
        nome: entrada.nome,
        ...(entrada.status === undefined ? {} : { status: entrada.status }),
      },
    });
  }

  public async buscarPorPublicId(publicId: string) {
    return this.prisma.tenant.findFirst({
      where: {
        public_id: publicId,
        deletado_at: null,
      },
    });
  }
}

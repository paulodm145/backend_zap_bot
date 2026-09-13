import type { PrismaClient } from '../generated/prisma/client.js';

export class RoteamentoWhatsappRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public buscarTenantAtivo(instanceName: string) {
    return this.prisma.roteamentoWhatsapp.findUnique({
      where: { instance_name: instanceName },
      select: {
        tenant: {
          select: {
            id: true,
            public_id: true,
            status: true,
            string_conexao_encrypted: true,
            deletado_at: true,
          },
        },
      },
    });
  }

  public buscar(instanceName: string) {
    return this.prisma.roteamentoWhatsapp.findUnique({ where: { instance_name: instanceName } });
  }

  public sincronizar(tenantId: number, instanceName: string) {
    return this.prisma.roteamentoWhatsapp.upsert({
      where: { instance_name: instanceName },
      create: { tenant_id: tenantId, instance_name: instanceName },
      update: { tenant_id: tenantId },
    });
  }

  public remover(tenantId: number, instanceName: string) {
    return this.prisma.roteamentoWhatsapp.deleteMany({
      where: { tenant_id: tenantId, instance_name: instanceName },
    });
  }

  public async obterLimiteDoTenant(tenantId: number): Promise<number> {
    const assinatura = await this.prisma.assinatura.findFirst({
      where: { tenant_id: tenantId, status: { in: ['ATIVA', 'MANUAL'] } },
      orderBy: { created_at: 'desc' },
      select: { plano: { select: { limite_contas_whatsapp: true } } },
    });
    return assinatura?.plano.limite_contas_whatsapp ?? 1;
  }
}

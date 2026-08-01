import type { PrismaClient } from '../generated/prisma/client.js';

export class RoteamentoWhatsappRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public buscarTenantAtivo(phoneNumberId: string) {
    return this.prisma.roteamentoWhatsapp.findUnique({
      where: { phone_number_id: phoneNumberId },
      select: {
        tenant: {
          select: {
            public_id: true,
            status: true,
            deletado_at: true,
          },
        },
      },
    });
  }

  public buscar(phoneNumberId: string) {
    return this.prisma.roteamentoWhatsapp.findUnique({ where: { phone_number_id: phoneNumberId } });
  }

  public sincronizar(tenantId: number, phoneNumberId: string) {
    return this.prisma.roteamentoWhatsapp.upsert({
      where: { phone_number_id: phoneNumberId },
      create: { tenant_id: tenantId, phone_number_id: phoneNumberId },
      update: { tenant_id: tenantId },
    });
  }

  public remover(tenantId: number, phoneNumberId: string) {
    return this.prisma.roteamentoWhatsapp.deleteMany({
      where: { tenant_id: tenantId, phone_number_id: phoneNumberId },
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

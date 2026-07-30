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
}

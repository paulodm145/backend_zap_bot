import type { Prisma, PrismaClient, RefreshToken } from '../generated/prisma/client.js';

export class RefreshTokenRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public criar(
    dados: Prisma.RefreshTokenUncheckedCreateInput,
    transacao: Prisma.TransactionClient = this.prisma,
  ): Promise<RefreshToken> {
    return transacao.refreshToken.create({ data: dados });
  }

  public buscarPorHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { token_hash: tokenHash } });
  }

  public async rotacionar(
    tokenAtualId: number,
    novoToken: Prisma.RefreshTokenUncheckedCreateInput,
  ): Promise<RefreshToken> {
    return this.prisma.$transaction(async (transacao) => {
      const criado = await this.criar(novoToken, transacao);
      await transacao.refreshToken.update({
        where: { id: tokenAtualId },
        data: {
          revogado_at: new Date(),
          motivo_revogacao: 'ROTACIONADO',
          substituido_por_id: criado.id,
        },
      });
      return criado;
    });
  }

  public async revogar(id: number, motivo: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id, revogado_at: null },
      data: { revogado_at: new Date(), motivo_revogacao: motivo },
    });
  }

  public async revogarFamilia(familia: string, motivo: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familia, revogado_at: null },
      data: { revogado_at: new Date(), motivo_revogacao: motivo },
    });
  }

  public async limparExpirados(agora = new Date()): Promise<number> {
    const resultado = await this.prisma.refreshToken.deleteMany({
      where: { expira_at: { lt: agora } },
    });
    return resultado.count;
  }
}

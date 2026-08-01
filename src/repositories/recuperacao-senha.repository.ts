import type { PrismaClient } from '../generated/prisma/client.js';

export class RecuperacaoSenhaRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async substituir(usuarioId: number, tokenHash: string, expiraAt: Date): Promise<void> {
    await this.prisma.$transaction(async (transacao) => {
      await transacao.tokenRecuperacaoSenha.updateMany({
        where: { usuario_id: usuarioId, consumido_at: null },
        data: { consumido_at: new Date() },
      });
      await transacao.tokenRecuperacaoSenha.create({
        data: { usuario_id: usuarioId, token_hash: tokenHash, expira_at: expiraAt },
      });
      await transacao.auditoriaInterna.create({
        data: { acao: 'SOLICITAR_RECUPERACAO_SENHA', entidade: 'USUARIO' },
      });
    });
  }

  public async redefinir(
    tokenHash: string,
    senhaHash: string,
    agora = new Date(),
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transacao) => {
      const token = await transacao.tokenRecuperacaoSenha.findUnique({
        where: { token_hash: tokenHash },
      });
      if (!token || token.consumido_at || token.expira_at <= agora || token.tentativas >= 5) {
        if (token && !token.consumido_at) {
          await transacao.tokenRecuperacaoSenha.update({
            where: { id: token.id },
            data: { tentativas: { increment: 1 } },
          });
        }
        return false;
      }
      const consumido = await transacao.tokenRecuperacaoSenha.updateMany({
        where: {
          id: token.id,
          consumido_at: null,
          expira_at: { gt: agora },
          tentativas: { lt: 5 },
        },
        data: { consumido_at: agora, tentativas: { increment: 1 } },
      });
      if (consumido.count !== 1) return false;
      await transacao.usuario.update({
        where: { id: token.usuario_id },
        data: { senha_hash: senhaHash },
      });
      await transacao.refreshToken.updateMany({
        where: { usuario_id: token.usuario_id, revogado_at: null },
        data: { revogado_at: agora, motivo_revogacao: 'SENHA_REDEFINIDA' },
      });
      await transacao.auditoriaInterna.create({
        data: { acao: 'REDEFINIR_SENHA', entidade: 'USUARIO' },
      });
      return true;
    });
  }
}

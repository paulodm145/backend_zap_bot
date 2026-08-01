import type { EstadoConversaFluxo } from '../dtos/fluxo.dto.js';
import type { Prisma, PrismaClient } from '../generated/prisma-tenant/client.js';

export class DirecionamentoAtendimentoRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public buscarAtendente(usuarioCentralPublicId: string) {
    return this.prisma.atendente.findFirst({
      where: {
        ativo: true,
        usuario: {
          usuario_central_public_id: usuarioCentralPublicId,
          ativo: true,
          deletado_at: null,
        },
      },
      select: { id: true, public_id: true, nome: true },
    });
  }

  public buscarConversa(publicId: string) {
    return this.prisma.conversa.findUnique({
      where: { public_id: publicId },
      select: {
        id: true,
        public_id: true,
        status: true,
        setor_id: true,
        atendente_id: true,
        estado_fluxo: true,
      },
    });
  }

  public possuiVinculo(atendenteId: number, setorId: number) {
    return this.prisma.atendenteSetor.count({
      where: {
        atendente_id: atendenteId,
        setor_id: setorId,
        setor: { ativo: true, deletado_at: null },
        atendente: { ativo: true },
      },
    });
  }

  public buscarSetor(publicId: string) {
    return this.prisma.setor.findFirst({
      where: { public_id: publicId, ativo: true, deletado_at: null },
      select: { id: true, public_id: true, nome: true },
    });
  }

  public buscarAtendentePorPublicId(publicId: string) {
    return this.prisma.atendente.findFirst({
      where: { public_id: publicId, ativo: true },
      select: { id: true, public_id: true, nome: true },
    });
  }

  public async assumirAtomico(
    conversaId: number,
    atendenteId: number,
    setorId: number,
    autorUsuarioPublicId: string,
  ) {
    return this.prisma.$transaction(async (transacao) => {
      const atualizado = await transacao.conversa.updateMany({
        where: {
          id: conversaId,
          setor_id: setorId,
          atendente_id: null,
          status: 'AGUARDANDO_ATENDENTE',
        },
        data: { atendente_id: atendenteId, status: 'COM_ATENDENTE' },
      });
      if (atualizado.count === 0) return false;
      await this.registrarMovimentacao(transacao, {
        conversaId,
        autorUsuarioPublicId,
        autorAtendenteId: atendenteId,
        destinoAtendenteId: atendenteId,
        destinoSetorId: setorId,
        acao: 'ASSUMIU',
      });
      return true;
    });
  }

  public async reatribuir(dados: {
    conversaId: number;
    autorAtendenteId?: number;
    autorUsuarioPublicId: string;
    origemAtendenteId?: number;
    destinoAtendenteId?: number;
    origemSetorId?: number;
    destinoSetorId: number;
    motivo: string;
  }) {
    return this.prisma.$transaction(async (transacao) => {
      await transacao.conversa.update({
        where: { id: dados.conversaId },
        data: {
          setor_id: dados.destinoSetorId,
          atendente_id: dados.destinoAtendenteId ?? null,
          status: dados.destinoAtendenteId ? 'COM_ATENDENTE' : 'AGUARDANDO_ATENDENTE',
          finalizada_at: null,
        },
      });
      await this.registrarMovimentacao(transacao, { ...dados, acao: 'REATRIBUIU' });
    });
  }

  public async encerrar(dados: {
    conversaId: number;
    autorAtendenteId?: number;
    autorUsuarioPublicId: string;
    origemAtendenteId?: number;
    origemSetorId?: number;
    motivo?: string;
    devolverAoBot: boolean;
  }) {
    return this.prisma.$transaction(async (transacao) => {
      await transacao.conversa.update({
        where: { id: dados.conversaId },
        data: dados.devolverAoBot
          ? { status: 'BOT', atendente_id: null, setor_id: null, finalizada_at: null }
          : { status: 'ENCERRADA', finalizada_at: new Date() },
      });
      await this.registrarMovimentacao(transacao, {
        conversaId: dados.conversaId,
        ...(dados.autorAtendenteId ? { autorAtendenteId: dados.autorAtendenteId } : {}),
        autorUsuarioPublicId: dados.autorUsuarioPublicId,
        ...(dados.origemAtendenteId ? { origemAtendenteId: dados.origemAtendenteId } : {}),
        ...(dados.origemSetorId ? { origemSetorId: dados.origemSetorId } : {}),
        ...(dados.motivo ? { motivo: dados.motivo } : {}),
        acao: dados.devolverAoBot ? 'DEVOLVEU_AO_BOT' : 'ENCERROU',
      });
    });
  }

  public async direcionarPeloFluxo(
    conversaPublicId: string,
    setorPublicId: string,
    estadoFluxo: EstadoConversaFluxo,
  ) {
    const setor = await this.buscarSetor(setorPublicId);
    const conversa = await this.buscarConversa(conversaPublicId);
    if (!setor || !conversa) return false;
    await this.prisma.$transaction(async (transacao) => {
      await transacao.conversa.update({
        where: { id: conversa.id },
        data: {
          setor_id: setor.id,
          atendente_id: null,
          status: 'AGUARDANDO_ATENDENTE',
          estado_fluxo: estadoFluxo,
        },
      });
      await this.registrarMovimentacao(transacao, {
        conversaId: conversa.id,
        ...(conversa.setor_id ? { origemSetorId: conversa.setor_id } : {}),
        destinoSetorId: setor.id,
        acao: 'DIRECIONOU_FLUXO',
      });
    });
    return true;
  }

  private async registrarMovimentacao(
    transacao: Prisma.TransactionClient,
    dados: {
      conversaId: number;
      autorAtendenteId?: number;
      autorUsuarioPublicId?: string;
      origemAtendenteId?: number;
      destinoAtendenteId?: number;
      origemSetorId?: number;
      destinoSetorId?: number;
      acao: string;
      motivo?: string;
    },
  ) {
    const ocorreuAt = new Date();
    await transacao.movimentacaoAtendimento.create({
      data: {
        conversa_id: dados.conversaId,
        autor_atendente_id: dados.autorAtendenteId ?? null,
        autor_usuario_public_id: dados.autorUsuarioPublicId ?? null,
        origem_atendente_id: dados.origemAtendenteId ?? null,
        destino_atendente_id: dados.destinoAtendenteId ?? null,
        origem_setor_id: dados.origemSetorId ?? null,
        destino_setor_id: dados.destinoSetorId ?? null,
        acao: dados.acao,
        motivo: dados.motivo ?? null,
      },
    });
    await transacao.mensagem.create({
      data: {
        conversa_id: dados.conversaId,
        tipo: 'SISTEMA',
        direcao: 'INTERNA',
        autor: 'SISTEMA',
        status_entrega: 'ENTREGUE',
        recebida: false,
        ocorreu_at: ocorreuAt,
        conteudo: { acao: dados.acao, motivo: dados.motivo ?? null },
      },
    });
  }
}

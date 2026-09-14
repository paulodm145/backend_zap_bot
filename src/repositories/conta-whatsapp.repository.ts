import type { Prisma, PrismaClient } from '../generated/prisma-tenant/client.js';
import type { ListarContasWhatsappEntrada } from '../dtos/conta-whatsapp.dto.js';
import { criarPaginacaoResultado } from '../dtos/paginacao.dto.js';

export const selecaoContaWhatsappSegura = {
  public_id: true,
  nome: true,
  instance_name: true,
  instance_id: true,
  numero_exibicao: true,
  status: true,
  fluxo: { select: { public_id: true, nome: true } },
  ultima_sincronizacao_at: true,
  ultimo_erro_codigo: true,
  ultimo_erro_mensagem: true,
  ativo: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.ContaWhatsappSelect;

export class ContaWhatsappRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async listar(entrada: ListarContasWhatsappEntrada) {
    const where: Prisma.ContaWhatsappWhereInput = {
      deletado_at: null,
      ...(entrada.busca
        ? {
            OR: [
              { nome: { contains: entrada.busca, mode: 'insensitive' } },
              { numero_exibicao: { contains: entrada.busca } },
            ],
          }
        : {}),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.contaWhatsapp.findMany({
        where,
        select: selecaoContaWhatsappSegura,
        skip: entrada.skip,
        take: entrada.take,
        orderBy: { nome: 'asc' },
      }),
      this.prisma.contaWhatsapp.count({ where }),
    ]);
    return criarPaginacaoResultado(dados, total, entrada);
  }

  public buscar(publicId: string, incluirSegredo = false) {
    return this.prisma.contaWhatsapp.findFirst({
      where: { public_id: publicId, deletado_at: null },
      ...(incluirSegredo ? {} : { select: selecaoContaWhatsappSegura }),
    });
  }

  public buscarPorInstancia(instanceName: string, incluirSegredo = false) {
    return this.prisma.contaWhatsapp.findFirst({
      where: { instance_name: instanceName, deletado_at: null },
      ...(incluirSegredo ? {} : { select: selecaoContaWhatsappSegura }),
    });
  }

  public contarAtivas() {
    return this.prisma.contaWhatsapp.count({ where: { ativo: true, deletado_at: null } });
  }

  public buscarAtivaDaConversa(conversaPublicId: string) {
    return this.prisma.contaWhatsapp.findFirst({
      where: {
        ativo: true,
        deletado_at: null,
        conversas: { some: { public_id: conversaPublicId } },
      },
    });
  }

  public criar(entrada: {
    nome: string;
    instanceName: string;
    instanceId: string;
    apiKeyEncrypted: string;
    fluxoId: number | null;
    autorUsuarioId: string;
  }) {
    return this.prisma.$transaction(async (transacao) => {
      const conta = await transacao.contaWhatsapp.create({
        data: {
          nome: entrada.nome,
          instance_name: entrada.instanceName,
          instance_id: entrada.instanceId,
          api_key_encrypted: entrada.apiKeyEncrypted,
          fluxo_id: entrada.fluxoId,
          status: 'CONECTANDO',
        },
        select: { ...selecaoContaWhatsappSegura, id: true, api_key_encrypted: true },
      });
      await this.auditar(transacao, conta.id, conta.public_id, entrada.autorUsuarioId, 'CRIAR');
      return conta;
    });
  }

  public atualizar(publicId: string, nome: string, autorUsuarioId: string) {
    return this.prisma.$transaction(async (transacao) => {
      const atual = await transacao.contaWhatsapp.findFirst({
        where: { public_id: publicId, deletado_at: null },
      });
      if (!atual) return null;
      const conta = await transacao.contaWhatsapp.update({
        where: { id: atual.id },
        data: { nome },
        select: selecaoContaWhatsappSegura,
      });
      await this.auditar(transacao, atual.id, atual.public_id, autorUsuarioId, 'ATUALIZAR');
      return conta;
    });
  }

  public async registrarEstadoConexao(
    id: number,
    estado: {
      status: 'CONECTANDO' | 'CONECTADO' | 'DESCONECTADO';
      numeroExibicao?: string;
      codigoErro?: string;
      mensagemErro?: string;
    },
  ) {
    return this.prisma.contaWhatsapp.update({
      where: { id },
      data: {
        status: estado.status,
        ultima_sincronizacao_at: new Date(),
        ...(estado.numeroExibicao ? { numero_exibicao: estado.numeroExibicao } : {}),
        ultimo_erro_codigo: estado.codigoErro ?? null,
        ultimo_erro_mensagem: estado.mensagemErro ?? null,
      },
      select: selecaoContaWhatsappSegura,
    });
  }

  public async alterarAtivo(publicId: string, ativo: boolean, autorUsuarioId: string) {
    const conta = await this.prisma.contaWhatsapp.findFirst({
      where: { public_id: publicId, deletado_at: null },
    });
    if (!conta) return null;
    return this.prisma.$transaction(async (transacao) => {
      const atualizada = await transacao.contaWhatsapp.update({
        where: { id: conta.id },
        data: { ativo },
      });
      await this.auditar(
        transacao,
        conta.id,
        conta.public_id,
        autorUsuarioId,
        ativo ? 'ATIVAR' : 'DESATIVAR',
      );
      return atualizada;
    });
  }

  public excluirCriacaoCompensatoria(id: number) {
    return this.prisma.contaWhatsapp.delete({ where: { id } });
  }

  /** Soft delete: preserva conversas/mensagens/auditorias já vinculadas à conta. */
  public async excluir(publicId: string, autorUsuarioId: string) {
    const conta = await this.prisma.contaWhatsapp.findFirst({
      where: { public_id: publicId, deletado_at: null },
    });
    if (!conta) return null;
    return this.prisma.$transaction(async (transacao) => {
      const excluida = await transacao.contaWhatsapp.update({
        where: { id: conta.id },
        data: { deletado_at: new Date(), ativo: false },
      });
      await this.auditar(transacao, conta.id, conta.public_id, autorUsuarioId, 'EXCLUIR');
      return excluida;
    });
  }

  private auditar(
    transacao: Prisma.TransactionClient,
    contaId: number,
    contaPublicId: string,
    autorUsuarioId: string,
    acao: string,
  ) {
    return transacao.auditoriaWhatsapp.create({
      data: {
        conta_whatsapp_id: contaId,
        conta_public_id: contaPublicId,
        autor_usuario_id: autorUsuarioId,
        acao,
      },
    });
  }
}

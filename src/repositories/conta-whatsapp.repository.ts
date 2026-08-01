import type { Prisma, PrismaClient } from '../generated/prisma-tenant/client.js';
import type {
  AtualizarContaWhatsappEntrada,
  ListarContasWhatsappEntrada,
} from '../dtos/conta-whatsapp.dto.js';
import { criarPaginacaoResultado } from '../dtos/paginacao.dto.js';

export const selecaoContaWhatsappSegura = {
  public_id: true,
  nome: true,
  phone_number_id: true,
  waba_id: true,
  numero_exibicao: true,
  versao_graph_api: true,
  status: true,
  ultima_validacao_at: true,
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
    phoneNumberId: string;
    wabaId: string;
    numeroExibicao?: string;
    versaoGraphApi: string;
    tokenEncrypted: string;
    autorUsuarioId: string;
  }) {
    return this.prisma.$transaction(async (transacao) => {
      const conta = await transacao.contaWhatsapp.create({
        data: {
          nome: entrada.nome,
          phone_number_id: entrada.phoneNumberId,
          waba_id: entrada.wabaId,
          ...(entrada.numeroExibicao ? { numero_exibicao: entrada.numeroExibicao } : {}),
          versao_graph_api: entrada.versaoGraphApi,
          token_encrypted: entrada.tokenEncrypted,
        },
      });
      await this.auditar(transacao, conta.id, conta.public_id, entrada.autorUsuarioId, 'CRIAR');
      return conta;
    });
  }

  public atualizar(
    publicId: string,
    entrada: AtualizarContaWhatsappEntrada,
    autorUsuarioId: string,
  ) {
    return this.prisma.$transaction(async (transacao) => {
      const atual = await transacao.contaWhatsapp.findFirst({
        where: { public_id: publicId, deletado_at: null },
      });
      if (!atual) return null;
      const conta = await transacao.contaWhatsapp.update({
        where: { id: atual.id },
        data: {
          ...(entrada.nome === undefined ? {} : { nome: entrada.nome }),
          ...(entrada.phoneNumberId === undefined
            ? {}
            : { phone_number_id: entrada.phoneNumberId }),
          ...(entrada.wabaId === undefined ? {} : { waba_id: entrada.wabaId }),
          ...(entrada.numeroExibicao === undefined
            ? {}
            : { numero_exibicao: entrada.numeroExibicao }),
          ...(entrada.versaoGraphApi === undefined
            ? {}
            : { versao_graph_api: entrada.versaoGraphApi }),
          status: 'PENDENTE',
          ultimo_erro_codigo: null,
          ultimo_erro_mensagem: null,
        },
      });
      await this.auditar(transacao, conta.id, conta.public_id, autorUsuarioId, 'ATUALIZAR');
      return { anterior: atual, conta };
    });
  }

  public async alterarToken(publicId: string, tokenEncrypted: string, autorUsuarioId: string) {
    const conta = await this.prisma.contaWhatsapp.findFirst({
      where: { public_id: publicId, deletado_at: null },
    });
    if (!conta) return null;
    return this.prisma.$transaction(async (transacao) => {
      const atualizada = await transacao.contaWhatsapp.update({
        where: { id: conta.id },
        data: {
          token_encrypted: tokenEncrypted,
          status: 'PENDENTE',
          ultimo_erro_codigo: null,
          ultimo_erro_mensagem: null,
        },
      });
      await this.auditar(transacao, conta.id, conta.public_id, autorUsuarioId, 'ROTACIONAR_TOKEN');
      return atualizada;
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

  public registrarValidacao(
    id: number,
    resultado: {
      valida: boolean;
      numeroExibicao?: string;
      codigoErro?: string;
      mensagemErro?: string;
    },
  ) {
    return this.prisma.contaWhatsapp.update({
      where: { id },
      data: {
        status: resultado.valida ? 'VALIDADA' : 'INVALIDA',
        ultima_validacao_at: new Date(),
        ...(resultado.numeroExibicao ? { numero_exibicao: resultado.numeroExibicao } : {}),
        ultimo_erro_codigo: resultado.codigoErro ?? null,
        ultimo_erro_mensagem: resultado.mensagemErro ?? null,
      },
      select: selecaoContaWhatsappSegura,
    });
  }

  public excluirCriacaoCompensatoria(id: number) {
    return this.prisma.contaWhatsapp.delete({ where: { id } });
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

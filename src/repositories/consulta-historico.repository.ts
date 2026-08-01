import type { Prisma, PrismaClient } from '../generated/prisma-tenant/client.js';
import type { ListarContatosEntrada, ListarConversasEntrada } from '../dtos/historico.dto.js';
import { criarPaginacaoResultado } from '../dtos/paginacao.dto.js';
import type { CursorTemporal } from '../helpers/cursor-temporal.helper.js';
import { normalizarTextoBusca } from '../helpers/texto.helper.js';

export class ConsultaHistoricoRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async listarContatos(entrada: ListarContatosEntrada, usuarioCentralPublicId?: string) {
    const where: Prisma.ContatoWhereInput = {
      ...(entrada.busca
        ? {
            OR: [
              { nome_normalizado: { contains: normalizarTextoBusca(entrada.busca) } },
              { telefone: { contains: entrada.busca.replace(/\D/g, '') } },
            ],
          }
        : {}),
      ...(usuarioCentralPublicId
        ? { conversas: { some: this.escopoConversa(usuarioCentralPublicId) } }
        : {}),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.contato.findMany({
        where,
        skip: entrada.skip,
        take: entrada.take,
        orderBy: [{ nome_normalizado: 'asc' }, { id: 'asc' }],
        select: {
          public_id: true,
          nome: true,
          telefone: true,
          atributos: true,
          created_at: true,
          updated_at: true,
          _count: { select: { conversas: true } },
        },
      }),
      this.prisma.contato.count({ where }),
    ]);
    return criarPaginacaoResultado(dados, total, entrada);
  }

  public async listarConversas(entrada: ListarConversasEntrada, usuarioCentralPublicId?: string) {
    const where: Prisma.ConversaWhereInput = {
      ...(entrada.status ? { status: entrada.status } : {}),
      ...(entrada.setorId ? { setor: { public_id: entrada.setorId } } : {}),
      ...(entrada.atendenteId ? { atendente: { public_id: entrada.atendenteId } } : {}),
      ...(entrada.contaId ? { conta_whatsapp: { public_id: entrada.contaId } } : {}),
      ...(entrada.busca
        ? {
            contato: {
              OR: [
                { nome_normalizado: { contains: normalizarTextoBusca(entrada.busca) } },
                { telefone: { contains: entrada.busca.replace(/\D/g, '') } },
              ],
            },
          }
        : {}),
      ...(usuarioCentralPublicId ? this.escopoConversa(usuarioCentralPublicId) : {}),
      ...(entrada.visao === 'FILA' ? { status: 'AGUARDANDO_ATENDENTE', atendente_id: null } : {}),
      ...(entrada.visao === 'MINHAS' && usuarioCentralPublicId
        ? {
            atendente: {
              usuario: {
                usuario_central_public_id: usuarioCentralPublicId,
                ativo: true,
                deletado_at: null,
              },
            },
          }
        : {}),
    };
    const selecao = this.selecaoConversa();
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.conversa.findMany({
        where,
        skip: entrada.skip,
        take: entrada.take,
        orderBy: [{ ultima_mensagem_at: 'desc' }, { id: 'desc' }],
        select: selecao,
      }),
      this.prisma.conversa.count({ where }),
    ]);
    return criarPaginacaoResultado(dados, total, entrada);
  }

  public buscarConversa(publicId: string, usuarioCentralPublicId?: string) {
    return this.prisma.conversa.findFirst({
      where: {
        public_id: publicId,
        ...(usuarioCentralPublicId ? this.escopoConversa(usuarioCentralPublicId) : {}),
      },
      select: { ...this.selecaoConversa(), estado_fluxo: true, janela_expira_at: true },
    });
  }

  public listarMensagens(
    conversaPublicId: string,
    take: number,
    cursor?: CursorTemporal,
    usuarioCentralPublicId?: string,
  ) {
    return this.prisma.mensagem.findMany({
      where: {
        conversa: {
          public_id: conversaPublicId,
          ...(usuarioCentralPublicId ? this.escopoConversa(usuarioCentralPublicId) : {}),
        },
        ...(cursor
          ? {
              OR: [
                { ocorreu_at: { lt: cursor.ocorreuAt } },
                { ocorreu_at: cursor.ocorreuAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      take: take + 1,
      orderBy: [{ ocorreu_at: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        public_id: true,
        whatsapp_message_id: true,
        tipo: true,
        direcao: true,
        autor: true,
        status_entrega: true,
        conteudo: true,
        midia_url: true,
        midia_mime_type: true,
        midia_nome: true,
        erro_codigo: true,
        erro_mensagem: true,
        ocorreu_at: true,
        enviada_at: true,
        created_at: true,
        resposta_mensagem: { select: { public_id: true } },
        autor_atendente: { select: { public_id: true, nome: true } },
      },
    });
  }

  private escopoConversa(usuarioCentralPublicId: string): Prisma.ConversaWhereInput {
    return {
      setor: {
        atendentes: {
          some: {
            atendente: {
              usuario: {
                usuario_central_public_id: usuarioCentralPublicId,
                ativo: true,
                deletado_at: null,
              },
            },
          },
        },
      },
    };
  }

  private selecaoConversa() {
    return {
      public_id: true,
      status: true,
      ultima_mensagem_at: true,
      finalizada_at: true,
      created_at: true,
      updated_at: true,
      contato: { select: { public_id: true, nome: true, telefone: true } },
      setor: { select: { public_id: true, nome: true } },
      atendente: { select: { public_id: true, nome: true } },
      conta_whatsapp: { select: { public_id: true, nome: true, numero_exibicao: true } },
      mensagens: {
        orderBy: [{ ocorreu_at: 'desc' as const }, { id: 'desc' as const }],
        take: 1,
        select: { public_id: true, tipo: true, autor: true, conteudo: true, ocorreu_at: true },
      },
    } satisfies Prisma.ConversaSelect;
  }
}

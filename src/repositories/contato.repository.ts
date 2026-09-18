import { Prisma, type PrismaClient } from '../generated/prisma-tenant/client.js';
import type { ListarContatosEntrada } from '../dtos/contato.dto.js';
import { criarPaginacaoResultado } from '../dtos/paginacao.dto.js';
import { converterParaJsonPrisma } from '../helpers/json-prisma.helper.js';
import { normalizarTextoBusca } from '../helpers/texto.helper.js';

/** Dados já normalizados pelo Service — o Repository não valida nem formata telefone/atributos. */
export interface DadosContato {
  telefone: string;
  nome?: string | null;
  atributos?: Record<string, unknown> | null;
}

export const selecaoContato = {
  public_id: true,
  nome: true,
  telefone: true,
  atributos: true,
  ativo: true,
  created_at: true,
  updated_at: true,
  _count: { select: { conversas: true } },
} satisfies Prisma.ContatoSelect;

export class ContatoRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async listar(entrada: ListarContatosEntrada) {
    const where: Prisma.ContatoWhereInput = {
      deletado_at: null,
      ...(entrada.ativo === undefined ? {} : { ativo: entrada.ativo }),
      ...(entrada.busca
        ? {
            OR: [
              { nome_normalizado: { contains: normalizarTextoBusca(entrada.busca) } },
              { telefone: { contains: entrada.busca.replace(/\D/g, '') } },
            ],
          }
        : {}),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.contato.findMany({
        where,
        skip: entrada.skip,
        take: entrada.take,
        orderBy: [{ nome_normalizado: 'asc' }, { id: 'asc' }],
        select: selecaoContato,
      }),
      this.prisma.contato.count({ where }),
    ]);
    return criarPaginacaoResultado(dados, total, entrada);
  }

  public buscar(publicId: string) {
    return this.prisma.contato.findFirst({
      where: { public_id: publicId, deletado_at: null },
      select: selecaoContato,
    });
  }

  /** Lookup enxuto para uso interno (precisa do id numérico, nunca exposto na API). */
  public buscarIdAtivo(publicId: string) {
    return this.prisma.contato.findFirst({
      where: { public_id: publicId, ativo: true, deletado_at: null },
      select: { id: true, public_id: true, nome: true, telefone: true },
    });
  }

  public buscarPorTelefone(telefone: string, ignorarPublicId?: string) {
    return this.prisma.contato.findFirst({
      where: {
        telefone,
        deletado_at: null,
        ...(ignorarPublicId ? { public_id: { not: ignorarPublicId } } : {}),
      },
      select: selecaoContato,
    });
  }

  public criar(entrada: DadosContato) {
    return this.prisma.contato.create({
      data: {
        telefone: entrada.telefone,
        ...(entrada.nome ? { nome: entrada.nome, nome_normalizado: normalizarTextoBusca(entrada.nome) } : {}),
        ...(entrada.atributos === undefined
          ? {}
          : { atributos: entrada.atributos === null ? Prisma.JsonNull : converterParaJsonPrisma(entrada.atributos) }),
      },
      select: selecaoContato,
    });
  }

  public atualizar(publicId: string, entrada: Partial<DadosContato>) {
    return this.prisma.contato.updateMany({
      where: { public_id: publicId, deletado_at: null },
      data: {
        ...(entrada.telefone === undefined ? {} : { telefone: entrada.telefone }),
        ...(entrada.nome === undefined
          ? {}
          : {
              nome: entrada.nome,
              nome_normalizado: entrada.nome ? normalizarTextoBusca(entrada.nome) : null,
            }),
        ...(entrada.atributos === undefined
          ? {}
          : { atributos: entrada.atributos === null ? Prisma.JsonNull : converterParaJsonPrisma(entrada.atributos) }),
      },
    });
  }

  public async excluir(publicId: string) {
    const resultado = await this.prisma.contato.updateMany({
      where: { public_id: publicId, deletado_at: null },
      data: { ativo: false, deletado_at: new Date() },
    });
    return resultado.count === 1;
  }

  public contarConversasAtivas(publicId: string) {
    return this.prisma.conversa.count({
      where: { contato: { public_id: publicId }, status: { not: 'ENCERRADA' } },
    });
  }
}

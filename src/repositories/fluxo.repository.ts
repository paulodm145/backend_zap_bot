import type { Prisma, PrismaClient } from '../generated/prisma-tenant/client.js';
import type {
  AtualizarFluxoEntrada,
  CriarFluxoEntrada,
  ListarFluxosEntrada,
} from '../dtos/fluxo.dto.js';
import { criarPaginacaoResultado } from '../dtos/paginacao.dto.js';
import { converterParaJsonPrisma } from '../helpers/json-prisma.helper.js';

export class FluxoRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async listar(entrada: ListarFluxosEntrada) {
    const where: Prisma.FluxoWhereInput = {
      deletado_at: null,
      ...(entrada.busca ? { nome: { contains: entrada.busca, mode: 'insensitive' } } : {}),
      ...(entrada.estado === 'RASCUNHO' ? { possui_alteracoes_nao_publicadas: true } : {}),
      ...(entrada.estado === 'PUBLICADO'
        ? { ativo: true, possui_alteracoes_nao_publicadas: false }
        : {}),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.fluxo.findMany({
        where,
        skip: entrada.skip,
        take: entrada.take,
        orderBy: { updated_at: 'desc' },
        select: {
          public_id: true,
          nome: true,
          versao: true,
          ativo: true,
          possui_alteracoes_nao_publicadas: true,
          publicado_at: true,
          created_at: true,
          updated_at: true,
        },
      }),
      this.prisma.fluxo.count({ where }),
    ]);
    return criarPaginacaoResultado(dados, total, entrada);
  }

  public buscarPorPublicId(publicId: string) {
    return this.prisma.fluxo.findFirst({
      where: { public_id: publicId, deletado_at: null },
      include: {
        versoes: {
          orderBy: { versao: 'desc' },
          take: 1,
          select: {
            public_id: true,
            versao: true,
            created_at: true,
          },
        },
      },
    });
  }

  public criar(entrada: CriarFluxoEntrada) {
    return this.prisma.fluxo.create({
      data: {
        nome: entrada.nome,
        definicao: converterParaJsonPrisma(entrada.definicao),
      },
    });
  }

  public atualizarRascunho(publicId: string, entrada: AtualizarFluxoEntrada) {
    return this.prisma.fluxo.updateMany({
      where: { public_id: publicId, deletado_at: null },
      data: {
        nome: entrada.nome,
        definicao: converterParaJsonPrisma(entrada.definicao),
        possui_alteracoes_nao_publicadas: true,
      },
    });
  }

  public async publicar(fluxoId: number, definicao: unknown, proximaVersao: number) {
    return this.prisma.$transaction(async (transacao) => {
      const versao = await transacao.fluxoVersao.create({
        data: {
          fluxo_id: fluxoId,
          versao: proximaVersao,
          definicao: converterParaJsonPrisma(definicao),
        },
      });
      await transacao.fluxo.update({
        where: { id: fluxoId },
        data: {
          versao: proximaVersao,
          ativo: true,
          possui_alteracoes_nao_publicadas: false,
          publicado_at: new Date(),
        },
      });
      return versao;
    });
  }

  public buscarVersaoPublicada(publicId: string) {
    return this.prisma.fluxo.findFirst({
      where: {
        public_id: publicId,
        ativo: true,
        deletado_at: null,
      },
      select: {
        public_id: true,
        versoes: {
          orderBy: { versao: 'desc' },
          take: 1,
        },
      },
    });
  }

  public buscarVersaoPorPublicId(publicId: string) {
    return this.prisma.fluxoVersao.findUnique({
      where: { public_id: publicId },
    });
  }

  public excluir(publicId: string) {
    return this.prisma.fluxo.updateMany({
      where: { public_id: publicId, deletado_at: null },
      data: { deletado_at: new Date(), ativo: false },
    });
  }
}

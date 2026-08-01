import type { PrismaClient } from '../generated/prisma-tenant/client.js';
import type {
  AtualizarSetorEntrada,
  CriarSetorEntrada,
  ListarSetoresEntrada,
} from '../dtos/setor.dto.js';
import { criarPaginacaoResultado } from '../dtos/paginacao.dto.js';
import { normalizarTextoBusca } from '../helpers/texto.helper.js';

export class SetorRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async buscarPublicIdsAtivos(publicIds: string[]): Promise<Set<string>> {
    const setores = await this.prisma.setor.findMany({
      where: {
        public_id: { in: publicIds },
        ativo: true,
        deletado_at: null,
      },
      select: { public_id: true },
    });
    return new Set(setores.map((setor) => setor.public_id));
  }

  public async listar(entrada: ListarSetoresEntrada, usuarioCentralPublicId?: string) {
    const where = {
      deletado_at: null,
      ...(entrada.ativo === undefined ? {} : { ativo: entrada.ativo }),
      ...(entrada.busca
        ? { nome_normalizado: { contains: normalizarTextoBusca(entrada.busca) } }
        : {}),
      ...(usuarioCentralPublicId
        ? {
            atendentes: {
              some: {
                atendente: { usuario: { usuario_central_public_id: usuarioCentralPublicId } },
              },
            },
          }
        : {}),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.setor.findMany({
        where,
        skip: entrada.skip,
        take: entrada.take,
        orderBy: { nome_normalizado: 'asc' },
      }),
      this.prisma.setor.count({ where }),
    ]);
    return criarPaginacaoResultado(dados, total, entrada);
  }

  public buscar(publicId: string, usuarioCentralPublicId?: string) {
    return this.prisma.setor.findFirst({
      where: {
        public_id: publicId,
        deletado_at: null,
        ...(usuarioCentralPublicId
          ? {
              atendentes: {
                some: {
                  atendente: { usuario: { usuario_central_public_id: usuarioCentralPublicId } },
                },
              },
            }
          : {}),
      },
    });
  }

  public buscarPorNome(nome: string, ignorarPublicId?: string) {
    return this.prisma.setor.findFirst({
      where: {
        nome_normalizado: normalizarTextoBusca(nome),
        deletado_at: null,
        ...(ignorarPublicId ? { public_id: { not: ignorarPublicId } } : {}),
      },
    });
  }

  public criar(entrada: CriarSetorEntrada) {
    return this.prisma.setor.create({
      data: {
        nome: entrada.nome,
        nome_normalizado: normalizarTextoBusca(entrada.nome),
        ...(entrada.descricao === undefined ? {} : { descricao: entrada.descricao }),
      },
    });
  }

  public atualizar(publicId: string, entrada: AtualizarSetorEntrada) {
    return this.prisma.setor.updateMany({
      where: { public_id: publicId, deletado_at: null },
      data: {
        ...(entrada.nome === undefined
          ? {}
          : { nome: entrada.nome, nome_normalizado: normalizarTextoBusca(entrada.nome) }),
        ...(entrada.descricao === undefined ? {} : { descricao: entrada.descricao }),
      },
    });
  }

  public async excluir(publicId: string) {
    const resultado = await this.prisma.setor.updateMany({
      where: { public_id: publicId, deletado_at: null },
      data: { ativo: false, deletado_at: new Date() },
    });
    return resultado.count === 1;
  }

  public contarConversasAtivas(publicId: string) {
    return this.prisma.conversa.count({
      where: { setor: { public_id: publicId }, status: { not: 'FINALIZADA' } },
    });
  }

  public async usadoEmFluxoPublicado(publicId: string): Promise<boolean> {
    const fluxos = await this.prisma.fluxo.findMany({
      where: { ativo: true, deletado_at: null },
      select: { versoes: { orderBy: { versao: 'desc' }, take: 1, select: { definicao: true } } },
    });
    return fluxos.some((fluxo) =>
      fluxo.versoes.some((versao) => this.contemSetor(versao.definicao, publicId)),
    );
  }

  public async substituirSetoresUsuario(usuarioPublicId: string, setoresPublicIds: string[]) {
    return this.prisma.$transaction(async (transacao) => {
      const usuario = await transacao.usuarioTenant.findFirst({
        where: { public_id: usuarioPublicId, ativo: true, deletado_at: null },
      });
      if (!usuario) return null;
      const setores = await transacao.setor.findMany({
        where: { public_id: { in: setoresPublicIds }, ativo: true, deletado_at: null },
      });
      if (setores.length !== new Set(setoresPublicIds).size) return { usuario, setores: null };
      const atendente = await transacao.atendente.upsert({
        where: { usuario_tenant_id: usuario.id },
        create: {
          usuario_tenant_id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          ativo: usuario.ativo,
        },
        update: { nome: usuario.nome, email: usuario.email, ativo: usuario.ativo },
      });
      await transacao.atendenteSetor.deleteMany({ where: { atendente_id: atendente.id } });
      if (setores.length > 0)
        await transacao.atendenteSetor.createMany({
          data: setores.map((setor) => ({ atendente_id: atendente.id, setor_id: setor.id })),
        });
      return { usuario, setores };
    });
  }

  public listarAtendentesElegiveis(setorPublicId: string) {
    return this.prisma.atendente.findMany({
      where: {
        ativo: true,
        usuario: { ativo: true, deletado_at: null },
        setores: { some: { setor: { public_id: setorPublicId, ativo: true, deletado_at: null } } },
      },
      select: {
        public_id: true,
        nome: true,
        email: true,
        usuario: { select: { public_id: true, papel: true } },
      },
      orderBy: { nome: 'asc' },
    });
  }

  private contemSetor(valor: unknown, publicId: string): boolean {
    if (Array.isArray(valor)) return valor.some((item) => this.contemSetor(item, publicId));
    if (typeof valor !== 'object' || valor === null) return false;
    const registro = valor as Record<string, unknown>;
    if (registro.setorId === publicId) return true;
    return Object.values(registro).some((item) => this.contemSetor(item, publicId));
  }
}

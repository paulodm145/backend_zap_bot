import type { Prisma, PrismaClient } from '../generated/prisma-tenant/client.js';
import type {
  AtualizarUsuarioTenantEntrada,
  ListarUsuariosTenantEntrada,
  PapelOperacional,
} from '../dtos/usuario-tenant.dto.js';
import { criarPaginacaoResultado } from '../dtos/paginacao.dto.js';
import { normalizarTextoBusca } from '../helpers/texto.helper.js';

const selecaoSegura = {
  public_id: true,
  usuario_central_public_id: true,
  nome: true,
  email: true,
  papel: true,
  ativo: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.UsuarioTenantSelect;

export class UsuarioTenantRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async listar(entrada: ListarUsuariosTenantEntrada) {
    const where: Prisma.UsuarioTenantWhereInput = {
      deletado_at: null,
      ...(entrada.papel ? { papel: entrada.papel } : {}),
      ...(entrada.ativo === undefined ? {} : { ativo: entrada.ativo }),
      ...(entrada.busca
        ? {
            OR: [
              { nome_normalizado: { contains: normalizarTextoBusca(entrada.busca) } },
              { email: { contains: entrada.busca.toLowerCase() } },
            ],
          }
        : {}),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.usuarioTenant.findMany({
        where,
        select: selecaoSegura,
        skip: entrada.skip,
        take: entrada.take,
        orderBy: { nome_normalizado: 'asc' },
      }),
      this.prisma.usuarioTenant.count({ where }),
    ]);
    return criarPaginacaoResultado(dados, total, entrada);
  }

  public buscar(publicId: string) {
    return this.prisma.usuarioTenant.findFirst({
      where: { public_id: publicId, deletado_at: null },
      select: selecaoSegura,
    });
  }

  public buscarPorCentralId(centralPublicId: string) {
    return this.prisma.usuarioTenant.findFirst({
      where: { usuario_central_public_id: centralPublicId, deletado_at: null },
    });
  }

  public buscarPerfilCompleto(centralPublicId: string) {
    return this.prisma.usuarioTenant.findFirst({
      where: { usuario_central_public_id: centralPublicId, deletado_at: null },
      select: {
        public_id: true,
        nome: true,
        email: true,
        papel: true,
        ativo: true,
        atendente: {
          select: {
            setores: {
              where: { setor: { ativo: true, deletado_at: null } },
              select: { setor: { select: { public_id: true, nome: true } } },
              orderBy: { setor: { nome_normalizado: 'asc' } },
            },
          },
        },
      },
    });
  }

  public contarAdministradoresAtivos() {
    return this.prisma.usuarioTenant.count({
      where: { papel: 'ADMIN_TENANT', ativo: true, deletado_at: null },
    });
  }

  public salvar(entrada: {
    centralPublicId: string;
    nome: string;
    email: string;
    papel: PapelOperacional;
    autorPublicId: string;
  }) {
    return this.prisma.$transaction(async (transacao) => {
      const usuario = await transacao.usuarioTenant.upsert({
        where: { usuario_central_public_id: entrada.centralPublicId },
        create: {
          usuario_central_public_id: entrada.centralPublicId,
          nome: entrada.nome,
          nome_normalizado: normalizarTextoBusca(entrada.nome),
          email: entrada.email,
          papel: entrada.papel,
        },
        update: {
          nome: entrada.nome,
          nome_normalizado: normalizarTextoBusca(entrada.nome),
          email: entrada.email,
          papel: entrada.papel,
          ativo: true,
          deletado_at: null,
        },
      });
      await this.auditar(transacao, usuario.public_id, entrada.autorPublicId, 'CRIAR_OU_REPARAR');
      return usuario;
    });
  }

  public atualizar(
    publicId: string,
    entrada: AtualizarUsuarioTenantEntrada,
    autorPublicId: string,
  ) {
    return this.prisma.$transaction(async (transacao) => {
      const atual = await transacao.usuarioTenant.findFirst({
        where: { public_id: publicId, deletado_at: null },
      });
      if (!atual) return null;
      const usuario = await transacao.usuarioTenant.update({
        where: { id: atual.id },
        data: {
          ...(entrada.nome === undefined
            ? {}
            : { nome: entrada.nome, nome_normalizado: normalizarTextoBusca(entrada.nome) }),
          ...(entrada.email === undefined ? {} : { email: entrada.email }),
          ...(entrada.papel === undefined ? {} : { papel: entrada.papel }),
        },
      });
      if (entrada.nome !== undefined || entrada.email !== undefined) {
        await transacao.atendente.updateMany({
          where: { usuario_tenant_id: usuario.id },
          data: {
            ...(entrada.nome === undefined ? {} : { nome: entrada.nome }),
            ...(entrada.email === undefined ? {} : { email: entrada.email }),
          },
        });
      }
      await this.auditar(transacao, usuario.public_id, autorPublicId, 'ATUALIZAR');
      return { anterior: atual, usuario };
    });
  }

  public alterarAtivo(publicId: string, ativo: boolean, autorPublicId: string) {
    return this.alterarEstado(publicId, { ativo }, autorPublicId, ativo ? 'ATIVAR' : 'DESATIVAR');
  }

  public excluir(publicId: string, autorPublicId: string) {
    return this.alterarEstado(
      publicId,
      { ativo: false, deletado_at: new Date() },
      autorPublicId,
      'EXCLUIR',
    );
  }

  public restaurarExclusao(publicId: string, ativo: boolean, autorPublicId: string) {
    return this.alterarEstado(
      publicId,
      { ativo, deletado_at: null },
      autorPublicId,
      'RESTAURAR_EXCLUSAO',
      true,
    );
  }

  public excluirCompensacao(centralPublicId: string) {
    return this.prisma.usuarioTenant.deleteMany({
      where: { usuario_central_public_id: centralPublicId },
    });
  }

  private alterarEstado(
    publicId: string,
    dados: Prisma.UsuarioTenantUpdateInput,
    autorPublicId: string,
    acao: string,
    incluirExcluido = false,
  ) {
    return this.prisma.$transaction(async (transacao) => {
      const atual = await transacao.usuarioTenant.findFirst({
        where: { public_id: publicId, ...(incluirExcluido ? {} : { deletado_at: null }) },
      });
      if (!atual) return null;
      const usuario = await transacao.usuarioTenant.update({
        where: { id: atual.id },
        data: dados,
      });
      await this.auditar(transacao, usuario.public_id, autorPublicId, acao);
      return usuario;
    });
  }

  private auditar(
    transacao: Prisma.TransactionClient,
    usuarioPublicId: string,
    autorPublicId: string,
    acao: string,
  ) {
    return transacao.auditoriaUsuarioTenant.create({
      data: {
        usuario_public_id: usuarioPublicId,
        autor_usuario_public_id: autorPublicId,
        acao,
      },
    });
  }
}

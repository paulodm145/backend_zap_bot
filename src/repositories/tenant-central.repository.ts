import type { Prisma, PrismaClient, StatusTenant } from '../generated/prisma/client.js';
import type { ListarTenantsEntrada } from '../dtos/tenant-interno.dto.js';
import { criarPaginacaoResultado } from '../dtos/paginacao.dto.js';

export interface CriarTenantCentral {
  nome: string;
  status?: StatusTenant;
}

export interface CriarProvisionamentoTenantCentral {
  chaveIdempotencia: string;
  nome: string;
  planoPublicId: string;
  administrador: {
    nome: string;
    email: string;
    senhaHash: string;
  };
}

export class TenantCentralRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async criar(entrada: CriarTenantCentral) {
    return this.prisma.tenant.create({
      data: {
        nome: entrada.nome,
        ...(entrada.status === undefined ? {} : { status: entrada.status }),
      },
    });
  }

  public async buscarPorPublicId(publicId: string) {
    return this.prisma.tenant.findFirst({
      where: {
        public_id: publicId,
        deletado_at: null,
      },
    });
  }

  public buscarAtivoDoUsuario(email: string, tenantPublicId: string) {
    return this.prisma.tenant.findFirst({
      where: {
        public_id: tenantPublicId,
        status: 'ATIVO',
        deletado_at: null,
        usuarios: {
          some: {
            email,
            ativo: true,
            deletado_at: null,
          },
        },
      },
    });
  }

  public buscarAdministrador(tenantId: number) {
    return this.prisma.usuario.findFirst({
      where: {
        tenant_id: tenantId,
        papel: 'ADMIN_TENANT',
        ativo: true,
        deletado_at: null,
      },
      orderBy: { created_at: 'asc' },
    });
  }

  public async listar(entrada: ListarTenantsEntrada) {
    const where: Prisma.TenantWhereInput = {
      deletado_at: null,
      ...(entrada.busca ? { nome: { contains: entrada.busca, mode: 'insensitive' } } : {}),
      ...(entrada.status ? { status: entrada.status } : {}),
      ...(entrada.planoId
        ? {
            assinaturas: {
              some: { plano: { public_id: entrada.planoId } },
            },
          }
        : {}),
    };
    const orderBy = {
      [entrada.ordenarPor]: entrada.ordem,
    } satisfies Prisma.TenantOrderByWithRelationInput;
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        skip: entrada.skip,
        take: entrada.take,
        orderBy,
        include: {
          assinaturas: {
            orderBy: { created_at: 'desc' },
            take: 1,
            include: { plano: true },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);
    return criarPaginacaoResultado(dados, total, entrada);
  }

  public detalhar(publicId: string) {
    return this.prisma.tenant.findFirst({
      where: { public_id: publicId, deletado_at: null },
      include: {
        usuarios: {
          where: { deletado_at: null },
          select: { public_id: true, nome: true, email: true, papel: true, ativo: true },
        },
        assinaturas: {
          orderBy: { created_at: 'desc' },
          include: { plano: true },
        },
      },
    });
  }

  public async alterarStatusAuditado(entrada: {
    tenantPublicId: string;
    status: StatusTenant;
    motivo: string;
    autorPublicId: string;
    ip?: string;
  }) {
    return this.prisma.$transaction(async (transacao) => {
      const atual = await transacao.tenant.findUnique({
        where: { public_id: entrada.tenantPublicId },
      });
      if (!atual) return null;
      const autor = await transacao.usuario.findUniqueOrThrow({
        where: { public_id: entrada.autorPublicId },
        select: { id: true },
      });
      const tenant = await transacao.tenant.update({
        where: { id: atual.id },
        data: { status: entrada.status },
      });
      await transacao.auditoriaInterna.create({
        data: {
          autor_usuario_id: autor.id,
          acao: 'ALTERAR_STATUS_TENANT',
          entidade: 'Tenant',
          entidade_public_id: atual.public_id,
          detalhes: {
            statusAnterior: atual.status,
            statusNovo: entrada.status,
            motivo: entrada.motivo,
          },
          ...(entrada.ip ? { ip: entrada.ip } : {}),
        },
      });
      return tenant;
    });
  }

  public async alterarPlanoAuditado(entrada: {
    tenantPublicId: string;
    planoPublicId: string;
    motivo: string;
    autorPublicId: string;
    ip?: string;
  }) {
    return this.prisma.$transaction(async (transacao) => {
      const tenant = await transacao.tenant.findUnique({
        where: { public_id: entrada.tenantPublicId },
      });
      const plano = await transacao.plano.findFirst({
        where: { public_id: entrada.planoPublicId, ativo: true },
      });
      if (!tenant || !plano) return null;
      const autor = await transacao.usuario.findUniqueOrThrow({
        where: { public_id: entrada.autorPublicId },
        select: { id: true },
      });
      await transacao.assinatura.updateMany({
        where: { tenant_id: tenant.id, status: { in: ['ATIVA', 'MANUAL'] } },
        data: { status: 'CANCELADA', cancelada_at: new Date() },
      });
      const assinatura = await transacao.assinatura.create({
        data: {
          tenant_id: tenant.id,
          plano_id: plano.id,
          status: 'MANUAL',
        },
        include: { plano: true },
      });
      await transacao.auditoriaInterna.create({
        data: {
          autor_usuario_id: autor.id,
          acao: 'ALTERAR_PLANO_TENANT',
          entidade: 'Tenant',
          entidade_public_id: tenant.public_id,
          detalhes: { planoNovo: plano.public_id, motivo: entrada.motivo },
          ...(entrada.ip ? { ip: entrada.ip } : {}),
        },
      });
      return assinatura;
    });
  }

  public buscarPorChaveProvisionamento(chave: string) {
    return this.prisma.tenant.findUnique({
      where: { provisionamento_chave: chave },
      include: { usuarios: true, assinaturas: { include: { plano: true } } },
    });
  }

  public async criarProvisionamento(entrada: CriarProvisionamentoTenantCentral) {
    return this.prisma.$transaction(async (transacao) => {
      const existente = await transacao.tenant.findUnique({
        where: { provisionamento_chave: entrada.chaveIdempotencia },
      });
      if (existente) return existente;
      const plano = await transacao.plano.findFirst({
        where: { public_id: entrada.planoPublicId, ativo: true },
      });
      if (!plano) return null;
      return transacao.tenant.create({
        data: {
          provisionamento_chave: entrada.chaveIdempotencia,
          nome: entrada.nome,
          status: 'PROVISIONANDO',
          etapa_provisionamento: 'REGISTRO_CENTRAL_CRIADO',
          usuarios: {
            create: {
              nome: entrada.administrador.nome,
              email: entrada.administrador.email,
              senha_hash: entrada.administrador.senhaHash,
              papel: 'ADMIN_TENANT',
            },
          },
          assinaturas: {
            create: { plano_id: plano.id, status: 'MANUAL' },
          },
        },
      });
    });
  }

  public atualizarProvisionamento(
    id: number,
    dados: {
      etapa: string;
      status?: StatusTenant;
      nomeBanco?: string;
      stringConexaoCriptografada?: string;
      erro?: string | null;
    },
  ) {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        etapa_provisionamento: dados.etapa,
        ...(dados.status ? { status: dados.status } : {}),
        ...(dados.nomeBanco ? { nome_do_banco: dados.nomeBanco } : {}),
        ...(dados.stringConexaoCriptografada
          ? { string_conexao_encrypted: dados.stringConexaoCriptografada }
          : {}),
        ...(dados.erro !== undefined ? { erro_provisionamento: dados.erro } : {}),
      },
    });
  }
}

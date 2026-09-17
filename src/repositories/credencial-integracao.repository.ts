import { criarPaginacaoResultado } from '../dtos/paginacao.dto.js';
import type { ListarCredenciaisIntegracaoEntrada } from '../dtos/credencial-integracao.dto.js';
import type { PrismaClient } from '../generated/prisma-tenant/client.js';
import { normalizarTextoBusca } from '../helpers/texto.helper.js';

/**
 * `configuracao_encrypted` nunca entra nos `select` de leitura: quem precisa
 * do segredo é o executor da chamada HTTP, através de `buscarConfiguracao`.
 */
const CAMPOS_PUBLICOS = {
  public_id: true,
  nome: true,
  tipo_auth: true,
  base_url: true,
  ativo: true,
  created_at: true,
  updated_at: true,
} as const;

export class CredencialIntegracaoRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async listar(entrada: ListarCredenciaisIntegracaoEntrada) {
    const where = {
      ...(entrada.ativo === undefined ? {} : { ativo: entrada.ativo }),
      ...(entrada.busca
        ? { nome_normalizado: { contains: normalizarTextoBusca(entrada.busca) } }
        : {}),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.credencialIntegracao.findMany({
        where,
        select: CAMPOS_PUBLICOS,
        skip: entrada.skip,
        take: entrada.take,
        orderBy: { nome_normalizado: 'asc' },
      }),
      this.prisma.credencialIntegracao.count({ where }),
    ]);
    return criarPaginacaoResultado(dados, total, entrada);
  }

  public buscar(publicId: string) {
    return this.prisma.credencialIntegracao.findUnique({
      where: { public_id: publicId },
      select: CAMPOS_PUBLICOS,
    });
  }

  public buscarPorNome(nome: string, ignorarPublicId?: string) {
    return this.prisma.credencialIntegracao.findFirst({
      where: {
        nome_normalizado: normalizarTextoBusca(nome),
        ...(ignorarPublicId ? { public_id: { not: ignorarPublicId } } : {}),
      },
      select: { public_id: true },
    });
  }

  public buscarConfiguracao(publicId: string) {
    return this.prisma.credencialIntegracao.findFirst({
      where: { public_id: publicId, ativo: true },
      select: { public_id: true, base_url: true, configuracao_encrypted: true },
    });
  }

  public criar(dados: {
    nome: string;
    baseUrl: string;
    tipoAuth: string;
    configuracaoEncrypted: string;
  }) {
    return this.prisma.credencialIntegracao.create({
      data: {
        nome: dados.nome,
        nome_normalizado: normalizarTextoBusca(dados.nome),
        base_url: dados.baseUrl,
        tipo_auth: dados.tipoAuth,
        configuracao_encrypted: dados.configuracaoEncrypted,
      },
      select: CAMPOS_PUBLICOS,
    });
  }

  public async atualizar(
    publicId: string,
    dados: {
      nome?: string;
      baseUrl?: string;
      tipoAuth?: string;
      configuracaoEncrypted?: string;
    },
  ) {
    const resultado = await this.prisma.credencialIntegracao.updateMany({
      where: { public_id: publicId },
      data: {
        ...(dados.nome === undefined
          ? {}
          : { nome: dados.nome, nome_normalizado: normalizarTextoBusca(dados.nome) }),
        ...(dados.baseUrl === undefined ? {} : { base_url: dados.baseUrl }),
        ...(dados.tipoAuth === undefined ? {} : { tipo_auth: dados.tipoAuth }),
        ...(dados.configuracaoEncrypted === undefined
          ? {}
          : { configuracao_encrypted: dados.configuracaoEncrypted }),
      },
    });
    return resultado.count === 1;
  }

  public async desativar(publicId: string) {
    const resultado = await this.prisma.credencialIntegracao.updateMany({
      where: { public_id: publicId, ativo: true },
      data: { ativo: false },
    });
    return resultado.count === 1;
  }
}

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

  /**
   * Procura a credencial na última versão publicada de cada fluxo ativo. A
   * varredura é recursiva sobre o JSON, como em `SetorRepository`, para não
   * depender do formato exato do grafo.
   */
  public async usadaEmFluxoPublicado(publicId: string): Promise<boolean> {
    const fluxos = await this.prisma.fluxo.findMany({
      where: { ativo: true, deletado_at: null },
      select: { versoes: { orderBy: { versao: 'desc' }, take: 1, select: { definicao: true } } },
    });
    return fluxos.some((fluxo) =>
      fluxo.versoes.some((versao) => this.contemCredencial(versao.definicao, publicId)),
    );
  }

  private contemCredencial(valor: unknown, publicId: string): boolean {
    if (Array.isArray(valor)) return valor.some((item) => this.contemCredencial(item, publicId));
    if (typeof valor !== 'object' || valor === null) return false;
    const registro = valor as Record<string, unknown>;
    if (registro.credencialId === publicId) return true;
    return Object.values(registro).some((item) => this.contemCredencial(item, publicId));
  }

  public async desativar(publicId: string) {
    const resultado = await this.prisma.credencialIntegracao.updateMany({
      where: { public_id: publicId, ativo: true },
      data: { ativo: false },
    });
    return resultado.count === 1;
  }
}

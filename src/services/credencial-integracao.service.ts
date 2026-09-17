import type {
  AtualizarCredencialIntegracaoEntrada,
  AutenticacaoIntegracao,
  CriarCredencialIntegracaoEntrada,
  ListarCredenciaisIntegracaoEntrada,
} from '../dtos/credencial-integracao.dto.js';
import { ConflitoError, NaoEncontradoError } from '../erros/erro-aplicacao.js';
import type { CredencialIntegracaoRepository } from '../repositories/credencial-integracao.repository.js';
import type { CriptografiaService } from './criptografia.service.js';

/**
 * Regra central: o segredo entra criptografado e nunca volta. A API expõe
 * apenas `tipo_auth` e `base_url`, o suficiente para o editor montar o bloco
 * de integração sem nunca transportar token de cliente.
 */
export class CredencialIntegracaoService {
  public constructor(
    private readonly repositorio: CredencialIntegracaoRepository,
    private readonly criptografia: CriptografiaService,
  ) {}

  public listar(entrada: ListarCredenciaisIntegracaoEntrada) {
    return this.repositorio.listar(entrada);
  }

  public async buscar(publicId: string) {
    const credencial = await this.repositorio.buscar(publicId);
    if (!credencial) throw new NaoEncontradoError('Credencial de integração não encontrada');
    return credencial;
  }

  public async criar(entrada: CriarCredencialIntegracaoEntrada) {
    await this.exigirNomeDisponivel(entrada.nome);
    return this.repositorio.criar({
      nome: entrada.nome,
      baseUrl: entrada.baseUrl,
      tipoAuth: entrada.autenticacao.tipo,
      configuracaoEncrypted: this.protegerAutenticacao(entrada.autenticacao),
    });
  }

  public async atualizar(publicId: string, entrada: AtualizarCredencialIntegracaoEntrada) {
    if (entrada.nome !== undefined) await this.exigirNomeDisponivel(entrada.nome, publicId);
    const atualizou = await this.repositorio.atualizar(publicId, {
      ...(entrada.nome === undefined ? {} : { nome: entrada.nome }),
      ...(entrada.baseUrl === undefined ? {} : { baseUrl: entrada.baseUrl }),
      ...(entrada.autenticacao === undefined
        ? {}
        : {
            tipoAuth: entrada.autenticacao.tipo,
            configuracaoEncrypted: this.protegerAutenticacao(entrada.autenticacao),
          }),
    });
    if (!atualizou) throw new NaoEncontradoError('Credencial de integração não encontrada');
    return this.buscar(publicId);
  }

  public async desativar(publicId: string) {
    if (await this.repositorio.usadaEmFluxoPublicado(publicId)) {
      throw new ConflitoError(
        'A credencial é usada por um fluxo publicado; ajuste o fluxo antes de desativar',
      );
    }
    const desativou = await this.repositorio.desativar(publicId);
    if (!desativou) throw new NaoEncontradoError('Credencial de integração não encontrada');
  }

  private protegerAutenticacao(autenticacao: AutenticacaoIntegracao): string {
    return this.criptografia.criptografar(JSON.stringify(autenticacao));
  }

  private async exigirNomeDisponivel(nome: string, ignorarPublicId?: string): Promise<void> {
    const existente = await this.repositorio.buscarPorNome(nome, ignorarPublicId);
    if (existente) throw new ConflitoError('Já existe uma credencial com esse nome');
  }
}

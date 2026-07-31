import {
  cepBrasilApiSchema,
  estadosBrasilApiSchema,
  municipiosBrasilApiSchema,
  type CepBrasilApi,
  type EstadoBrasilApi,
  type MunicipioBrasilApi,
} from '../dtos/brasil-api.dto.js';
import { ValidacaoError } from '../erros/erro-aplicacao.js';

type FuncaoFetch = typeof fetch;

export class BrasilApiService {
  public constructor(
    private readonly urlBase = 'https://brasilapi.com.br/api',
    private readonly timeoutMs = 10_000,
    private readonly maxTentativas = 3,
    private readonly executarFetch: FuncaoFetch = fetch,
  ) {}

  public async listarEstados(): Promise<EstadoBrasilApi[]> {
    return estadosBrasilApiSchema.parse(await this.buscarJson('/ibge/uf/v1'));
  }

  public async listarMunicipios(siglaUf: string): Promise<MunicipioBrasilApi[]> {
    const uf = siglaUf.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(uf)) throw new ValidacaoError('Sigla de UF inválida');
    return municipiosBrasilApiSchema.parse(
      await this.buscarJson(`/ibge/municipios/v1/${encodeURIComponent(uf)}?providers=gov`),
    );
  }

  public async consultarCep(cep: string): Promise<CepBrasilApi> {
    const digitos = cep.replace(/\D/g, '');
    if (!/^\d{8}$/.test(digitos)) throw new ValidacaoError('CEP inválido');
    return cepBrasilApiSchema.parse(await this.buscarJson(`/cep/v2/${digitos}`));
  }

  private async buscarJson(caminho: string): Promise<unknown> {
    let ultimoErro: unknown;
    for (let tentativa = 1; tentativa <= this.maxTentativas; tentativa += 1) {
      try {
        const resposta = await this.executarFetch(`${this.urlBase}${caminho}`, {
          headers: { Accept: 'application/json', 'User-Agent': 'ZapBot/1.0' },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (resposta.ok) return await resposta.json();
        if (resposta.status < 500 || tentativa === this.maxTentativas) {
          throw new Error(`BrasilAPI respondeu com status ${String(resposta.status)}`);
        }
        ultimoErro = new Error(`BrasilAPI respondeu com status ${String(resposta.status)}`);
      } catch (erro: unknown) {
        ultimoErro = erro;
        if (tentativa === this.maxTentativas || !this.transitorio(erro)) break;
      }
    }
    throw new Error(`Falha ao consultar BrasilAPI: ${String(ultimoErro)}`);
  }

  private transitorio(erro: unknown): boolean {
    return (
      erro instanceof TypeError ||
      (erro instanceof DOMException && erro.name === 'TimeoutError') ||
      (erro instanceof Error && erro.message.includes('status 5'))
    );
  }
}

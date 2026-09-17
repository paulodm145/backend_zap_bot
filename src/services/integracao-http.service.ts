import { lookup } from 'node:dns/promises';

import type { AutenticacaoIntegracao } from '../dtos/credencial-integracao.dto.js';
import type { MetodoIntegracaoHttp } from '../dtos/fluxo.dto.js';
import { hostInterno, validarUrlExterna } from '../helpers/url-externa.helper.js';

export interface RequisicaoIntegracao {
  metodo: MetodoIntegracaoHttp;
  url: string;
  baseUrlAutorizada: string;
  autenticacao: AutenticacaoIntegracao;
  corpo?: string;
}

export type FalhaIntegracao =
  | 'URL_INVALIDA'
  | 'FORA_DA_BASE_AUTORIZADA'
  | 'HOST_PRIVADO'
  | 'TEMPO_ESGOTADO'
  | 'RESPOSTA_GRANDE'
  | 'RESPOSTA_NAO_JSON'
  | 'REDIRECIONAMENTO'
  | 'STATUS_ERRO'
  | 'FALHA_REDE';

export type ResultadoIntegracaoHttp =
  | { sucesso: true; status: number; corpo: unknown }
  | { sucesso: false; falha: FalhaIntegracao; status?: number };

const TEMPO_LIMITE_MS = 10_000;
const TAMANHO_MAXIMO_BYTES = 256 * 1024;

/**
 * Executa a chamada externa do bloco `integracao_http`.
 *
 * Camadas de contenção, nesta ordem: a URL precisa ser HTTPS e válida, precisa
 * começar pela `base_url` da credencial (allowlist por tenant), e o host
 * precisa resolver para IP público — esta última é a barreira que a validação
 * sintática do cadastro não alcança. Redirecionamento não é seguido, porque
 * seguir levaria a um destino que nenhuma dessas camadas aprovou.
 *
 * Nada do que esta classe recebe é registrado em log: a autenticação chega
 * decifrada e o corpo pode conter dado pessoal do contato.
 */
export class IntegracaoHttpService {
  public constructor(
    private readonly executarFetch: typeof fetch = fetch,
    private readonly resolverHost: typeof lookup = lookup,
  ) {}

  public async executar(requisicao: RequisicaoIntegracao): Promise<ResultadoIntegracaoHttp> {
    const url = validarUrlExterna(requisicao.url);
    if (!url.valida) {
      return {
        sucesso: false,
        falha: url.motivo === 'HOST_PRIVADO' ? 'HOST_PRIVADO' : 'URL_INVALIDA',
      };
    }
    if (!this.dentroDaBase(url.url, requisicao.baseUrlAutorizada)) {
      return { sucesso: false, falha: 'FORA_DA_BASE_AUTORIZADA' };
    }
    if (await this.resolveParaRedeInterna(url.url.hostname)) {
      return { sucesso: false, falha: 'HOST_PRIVADO' };
    }

    let resposta: Response;
    try {
      resposta = await this.executarFetch(url.url, {
        method: requisicao.metodo,
        headers: this.cabecalhos(requisicao),
        redirect: 'manual',
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        ...(requisicao.corpo === undefined ? {} : { body: requisicao.corpo }),
      });
    } catch (erro: unknown) {
      const expirou = erro instanceof Error && erro.name === 'TimeoutError';
      return { sucesso: false, falha: expirou ? 'TEMPO_ESGOTADO' : 'FALHA_REDE' };
    }

    if (resposta.status >= 300 && resposta.status < 400) {
      return { sucesso: false, falha: 'REDIRECIONAMENTO', status: resposta.status };
    }
    if (!resposta.ok) {
      return { sucesso: false, falha: 'STATUS_ERRO', status: resposta.status };
    }

    const texto = await this.lerComLimite(resposta);
    if (texto === null) {
      return { sucesso: false, falha: 'RESPOSTA_GRANDE', status: resposta.status };
    }
    try {
      return { sucesso: true, status: resposta.status, corpo: JSON.parse(texto) };
    } catch {
      return { sucesso: false, falha: 'RESPOSTA_NAO_JSON', status: resposta.status };
    }
  }

  private dentroDaBase(url: URL, baseUrl: string): boolean {
    let base: URL;
    try {
      base = new URL(baseUrl);
    } catch {
      return false;
    }
    if (url.origin !== base.origin) return false;
    const caminhoBase = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
    return url.pathname === base.pathname || url.pathname.startsWith(caminhoBase);
  }

  private async resolveParaRedeInterna(hostname: string): Promise<boolean> {
    try {
      const enderecos = await this.resolverHost(hostname, { all: true });
      return enderecos.some((endereco) => hostInterno(endereco.address));
    } catch {
      // Sem resolução não há chamada possível; tratar como bloqueio evita
      // deixar a decisão para o fetch.
      return true;
    }
  }

  private cabecalhos(requisicao: RequisicaoIntegracao): Record<string, string> {
    const base: Record<string, string> = { Accept: 'application/json' };
    if (requisicao.corpo !== undefined) base['Content-Type'] = 'application/json';
    const autenticacao = requisicao.autenticacao;
    switch (autenticacao.tipo) {
      case 'BEARER':
        return { ...base, Authorization: `Bearer ${autenticacao.token}` };
      case 'API_KEY_HEADER':
        return { ...base, [autenticacao.cabecalho]: autenticacao.valor };
      case 'BASIC': {
        const credencial = Buffer.from(
          `${autenticacao.usuario}:${autenticacao.senha}`,
          'utf8',
        ).toString('base64');
        return { ...base, Authorization: `Basic ${credencial}` };
      }
      case 'NENHUMA':
        return base;
    }
  }

  /** Lê no máximo `TAMANHO_MAXIMO_BYTES`, abortando antes de materializar resposta grande. */
  private async lerComLimite(resposta: Response): Promise<string | null> {
    const declarado = Number(resposta.headers.get('content-length') ?? Number.NaN);
    if (Number.isFinite(declarado) && declarado > TAMANHO_MAXIMO_BYTES) return null;

    const leitor: ReadableStreamDefaultReader<Uint8Array> | undefined = resposta.body?.getReader();
    if (!leitor) return '';
    const partes: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > TAMANHO_MAXIMO_BYTES) {
        await leitor.cancel();
        return null;
      }
      partes.push(value);
    }
    return Buffer.concat(partes).toString('utf8');
  }
}

import { describe, expect, it, vi } from 'vitest';

import type { AutenticacaoIntegracao } from '../../src/dtos/credencial-integracao.dto.js';
import { IntegracaoHttpService } from '../../src/services/integracao-http.service.js';

const BASE = 'https://api.erp-exemplo.com/v1';

function dnsPublico() {
  return vi.fn().mockResolvedValue([{ address: '203.0.113.10', family: 4 }]);
}

function respostaJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function servico(fetchSimulado: typeof fetch, dns = dnsPublico()) {
  return new IntegracaoHttpService(fetchSimulado, dns as never);
}

const requisicaoBase = {
  metodo: 'GET' as const,
  url: `${BASE}/pedidos/1`,
  baseUrlAutorizada: BASE,
  autenticacao: { tipo: 'NENHUMA' } as AutenticacaoIntegracao,
};

describe('IntegracaoHttpService', () => {
  it('executa chamada e devolve o JSON', async () => {
    const executar = vi.fn().mockResolvedValue(respostaJson({ status: 'OK' }));
    const resultado = await servico(executar as never).executar(requisicaoBase);
    expect(resultado).toEqual({ sucesso: true, status: 200, corpo: { status: 'OK' } });
    expect(executar).toHaveBeenCalledOnce();
  });

  it.each([
    ['BEARER', { tipo: 'BEARER', token: 'abc' }, 'Authorization', 'Bearer abc'],
    ['API_KEY_HEADER', { tipo: 'API_KEY_HEADER', cabecalho: 'X-Key', valor: 'k1' }, 'X-Key', 'k1'],
    [
      'BASIC',
      { tipo: 'BASIC', usuario: 'ana', senha: 's3nha' },
      'Authorization',
      `Basic ${Buffer.from('ana:s3nha').toString('base64')}`,
    ],
  ])('monta cabeçalho de autenticação %s', async (_nome, autenticacao, cabecalho, esperado) => {
    const executar = vi.fn().mockResolvedValue(respostaJson({}));
    await servico(executar as never).executar({
      ...requisicaoBase,
      autenticacao: autenticacao as AutenticacaoIntegracao,
    });
    const opcoes = executar.mock.calls[0]?.[1] as { headers: Record<string, string> };
    expect(opcoes.headers[cabecalho]).toBe(esperado);
  });

  it('recusa URL fora da base autorizada sem chamar a rede', async () => {
    const executar = vi.fn();
    const resultado = await servico(executar as never).executar({
      ...requisicaoBase,
      url: 'https://api.erp-exemplo.com/outro/pedidos/1',
    });
    expect(resultado).toEqual({ sucesso: false, falha: 'FORA_DA_BASE_AUTORIZADA' });
    expect(executar).not.toHaveBeenCalled();
  });

  it('recusa host de outro domínio mesmo com prefixo parecido', async () => {
    const executar = vi.fn();
    const resultado = await servico(executar as never).executar({
      ...requisicaoBase,
      url: 'https://api.erp-exemplo.com.invasor.test/v1/pedidos/1',
    });
    expect(resultado).toEqual({ sucesso: false, falha: 'FORA_DA_BASE_AUTORIZADA' });
    expect(executar).not.toHaveBeenCalled();
  });

  it('bloqueia domínio público que resolve para IP privado', async () => {
    const executar = vi.fn();
    const dns = vi.fn().mockResolvedValue([{ address: '10.0.0.7', family: 4 }]);
    const resultado = await servico(executar as never, dns).executar(requisicaoBase);
    expect(resultado).toEqual({ sucesso: false, falha: 'HOST_PRIVADO' });
    expect(executar).not.toHaveBeenCalled();
  });

  it('bloqueia quando o DNS não resolve', async () => {
    const dns = vi.fn().mockRejectedValue(new Error('sem resolução'));
    const resultado = await servico(vi.fn() as never, dns).executar(requisicaoBase);
    expect(resultado).toEqual({ sucesso: false, falha: 'HOST_PRIVADO' });
  });

  it('não segue redirecionamento', async () => {
    const executar = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://x' } }));
    const resultado = await servico(executar as never).executar(requisicaoBase);
    expect(resultado).toEqual({ sucesso: false, falha: 'REDIRECIONAMENTO', status: 302 });
    const opcoes = executar.mock.calls[0]?.[1] as { redirect: string };
    expect(opcoes.redirect).toBe('manual');
  });

  it('classifica timeout separado de falha de rede', async () => {
    const expirou = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    const comTimeout = vi.fn().mockRejectedValue(expirou);
    expect(await servico(comTimeout as never).executar(requisicaoBase)).toEqual({
      sucesso: false,
      falha: 'TEMPO_ESGOTADO',
    });

    const comFalha = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    expect(await servico(comFalha as never).executar(requisicaoBase)).toEqual({
      sucesso: false,
      falha: 'FALHA_REDE',
    });
  });

  it('reporta status de erro da API externa', async () => {
    const executar = vi.fn().mockResolvedValue(respostaJson({ erro: 'x' }, 500));
    expect(await servico(executar as never).executar(requisicaoBase)).toEqual({
      sucesso: false,
      falha: 'STATUS_ERRO',
      status: 500,
    });
  });

  it('recusa resposta que não é JSON', async () => {
    const executar = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }));
    expect(await servico(executar as never).executar(requisicaoBase)).toEqual({
      sucesso: false,
      falha: 'RESPOSTA_NAO_JSON',
      status: 200,
    });
  });

  it('recusa resposta maior que o limite declarado', async () => {
    const executar = vi.fn().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': String(1024 * 1024) },
      }),
    );
    expect(await servico(executar as never).executar(requisicaoBase)).toEqual({
      sucesso: false,
      falha: 'RESPOSTA_GRANDE',
      status: 200,
    });
  });

  it('recusa resposta grande sem content-length', async () => {
    const corpo = new ReadableStream<Uint8Array>({
      start(controlador) {
        controlador.enqueue(new Uint8Array(300 * 1024));
        controlador.close();
      },
    });
    const executar = vi.fn().mockResolvedValue(new Response(corpo, { status: 200 }));
    const resultado = await servico(executar as never).executar(requisicaoBase);
    expect(resultado).toMatchObject({ sucesso: false, falha: 'RESPOSTA_GRANDE' });
  });
});

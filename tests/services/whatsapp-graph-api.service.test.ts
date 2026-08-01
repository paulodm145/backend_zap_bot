import { describe, expect, it, vi } from 'vitest';

import { WhatsappGraphApiService } from '../../src/services/whatsapp-graph-api.service.js';

describe('WhatsappGraphApiService', () => {
  it('valida a credencial sem devolver o token', async () => {
    const executarFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: '123456', display_phone_number: '+55 11 99999-9999' }), {
        status: 200,
      }),
    );
    const resultado = await new WhatsappGraphApiService(
      'https://graph.test',
      executarFetch,
    ).validar('123456', 'v23.0', 'token-super-secreto');

    expect(resultado).toEqual({ valida: true, numeroExibicao: '+55 11 99999-9999' });
    expect(executarFetch.mock.calls[0]?.[0]).toBe(
      'https://graph.test/v23.0/123456?fields=id,display_phone_number,verified_name',
    );
    expect(new Headers(executarFetch.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer token-super-secreto',
    );
  });

  it('sanitiza erro retornado pela Meta', async () => {
    const executarFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'token vazado' } }), { status: 401 }),
      );
    const resultado = await new WhatsappGraphApiService(
      'https://graph.test',
      executarFetch,
    ).validar('123456', 'v23.0', 'segredo');
    expect(resultado).toEqual({
      valida: false,
      codigoErro: 'META_HTTP_401',
      mensagemErro: 'A Meta recusou as credenciais informadas',
    });
    expect(JSON.stringify(resultado)).not.toContain('token vazado');
  });

  it('trata indisponibilidade sem expor detalhes técnicos', async () => {
    const executarFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error('segredo interno'));
    await expect(
      new WhatsappGraphApiService('https://graph.test', executarFetch).validar('1', 'v23.0', 'x'),
    ).resolves.toMatchObject({ valida: false, codigoErro: 'META_INDISPONIVEL' });
  });

  it('rejeita uma credencial vinculada a outro número', async () => {
    const executarFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'outro-id' }), { status: 200 }));
    await expect(
      new WhatsappGraphApiService('https://graph.test', executarFetch).validar(
        '123456',
        'v23.0',
        'segredo',
      ),
    ).resolves.toEqual({
      valida: false,
      codigoErro: 'PHONE_NUMBER_ID_DIVERGENTE',
      mensagemErro: 'A credencial não pertence ao número informado',
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErroEvolutionApi, EvolutionApiService } from '../../src/services/evolution-api.service.js';

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status });
}

describe('EvolutionApiService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('cria a instância, configura o webhook e devolve o QR code', async () => {
    const chamadas: { url: string; opcoes: RequestInit }[] = [];
    const executarFetch: typeof fetch = (entrada, opcoes) => {
      const url = entrada as string;
      chamadas.push({ url, opcoes: opcoes ?? {} });
      if (url.endsWith('/instance/create')) {
        return Promise.resolve(
          resposta({
            instance: { instanceName: 'tenant-1', instanceId: 'evo-1', status: 'connecting' },
            hash: 'apikey-gerada',
            qrcode: { base64: 'data:image/png;base64,QR' },
          }),
        );
      }
      return Promise.resolve(resposta({}));
    };
    const servico = new EvolutionApiService(
      'https://evolution.test',
      'chave-global',
      'http://api.test/api/v1/webhook/whatsapp',
      executarFetch,
    );

    const resultado = await servico.criarInstancia('tenant-1');

    expect(resultado).toEqual({
      instanceId: 'evo-1',
      apiKey: 'apikey-gerada',
      qrCodeBase64: 'data:image/png;base64,QR',
    });
    expect(chamadas).toHaveLength(2);
    expect(chamadas[0]?.url).toBe('https://evolution.test/instance/create');
    expect((chamadas[0]?.opcoes.headers as Record<string, string>).apikey).toBe('chave-global');
    expect(chamadas[1]?.url).toBe('https://evolution.test/webhook/set/tenant-1');
    expect((chamadas[1]?.opcoes.headers as Record<string, string>).apikey).toBe('apikey-gerada');
    const corpoWebhook: unknown = JSON.parse(chamadas[1]?.opcoes.body as string);
    expect(corpoWebhook).toMatchObject({
      webhook: { url: 'http://api.test/api/v1/webhook/whatsapp', enabled: true },
    });
  });

  it('reconecta e devolve um novo QR code quando disponível', async () => {
    const executarFetch = vi
      .fn()
      .mockResolvedValue(resposta({ base64: 'data:image/png;base64,NOVO' }));
    const servico = new EvolutionApiService(
      'https://evolution.test',
      'g',
      'http://api.test',
      executarFetch,
    );

    await expect(servico.reconectar('tenant-1', 'apikey-1')).resolves.toEqual({
      qrCodeBase64: 'data:image/png;base64,NOVO',
    });
    expect(executarFetch).toHaveBeenCalledWith(
      'https://evolution.test/instance/connect/tenant-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('não devolve qrCodeBase64 quando a instância já está conectada', async () => {
    const executarFetch = vi.fn().mockResolvedValue(resposta({ pairingCode: null }));
    const servico = new EvolutionApiService(
      'https://evolution.test',
      'g',
      'http://api.test',
      executarFetch,
    );

    await expect(servico.reconectar('tenant-1', 'apikey-1')).resolves.toEqual({});
  });

  it('consulta o estado de conexão da instância', async () => {
    const executarFetch = vi
      .fn()
      .mockResolvedValue(resposta({ instance: { instanceName: 'tenant-1', state: 'open' } }));
    const servico = new EvolutionApiService(
      'https://evolution.test',
      'g',
      'http://api.test',
      executarFetch,
    );

    await expect(servico.obterEstadoConexao('tenant-1', 'apikey-1')).resolves.toEqual({
      estado: 'open',
    });
  });

  // connection.update não traz o número pareado — só fetchInstances tem
  // ownerJid. Verificado manualmente contra uma instância conectada de
  // verdade: o campo `number` do próprio Baileys fica sempre null.
  it('extrai o número pareado do ownerJid em fetchInstances', async () => {
    const executarFetch = vi
      .fn()
      .mockResolvedValue(resposta([{ ownerJid: '5527998511410@s.whatsapp.net', number: null }]));
    const servico = new EvolutionApiService(
      'https://evolution.test',
      'g',
      'http://api.test',
      executarFetch,
    );

    await expect(servico.obterNumeroPareado('tenant-1', 'apikey-1')).resolves.toBe('5527998511410');
    expect(executarFetch).toHaveBeenCalledWith(
      'https://evolution.test/instance/fetchInstances?instanceName=tenant-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('devolve null quando a instância ainda não tem número pareado', async () => {
    const executarFetch = vi.fn().mockResolvedValue(resposta([{ ownerJid: null }]));
    const servico = new EvolutionApiService(
      'https://evolution.test',
      'g',
      'http://api.test',
      executarFetch,
    );

    await expect(servico.obterNumeroPareado('tenant-1', 'apikey-1')).resolves.toBeNull();
  });

  it('trata 404 como sucesso ao desconectar ou excluir instância ausente', async () => {
    const executarFetch = vi.fn().mockResolvedValue(resposta({}, 404));
    const servico = new EvolutionApiService(
      'https://evolution.test',
      'g',
      'http://api.test',
      executarFetch,
    );

    await expect(servico.desconectar('tenant-1', 'apikey-1')).resolves.toBeUndefined();
    await expect(servico.excluirInstancia('tenant-1', 'apikey-1')).resolves.toBeUndefined();
  });

  // Reproduz o 500 relatado ao clicar em "Desconectar": a sessão já tinha
  // caído sozinha (ex.: WhatsApp derrubou remotamente) e a Evolution responde
  // 400 "instance is not connected" a um logout redundante. O estado desejado
  // já foi alcançado, então isso deve ser sucesso, não erro.
  it('trata 400 "instance is not connected" como sucesso ao desconectar', async () => {
    const executarFetch = vi
      .fn()
      .mockResolvedValue(
        resposta(
          { status: 400, error: 'Bad Request', response: { message: ['not connected'] } },
          400,
        ),
      );
    const servico = new EvolutionApiService(
      'https://evolution.test',
      'g',
      'http://api.test',
      executarFetch,
    );

    await expect(servico.desconectar('tenant-1', 'apikey-1')).resolves.toBeUndefined();
  });

  it('propaga 400 de outra causa ao excluir a instância', async () => {
    const executarFetch = vi.fn().mockResolvedValue(resposta({}, 400));
    const servico = new EvolutionApiService(
      'https://evolution.test',
      'g',
      'http://api.test',
      executarFetch,
    );

    await expect(servico.excluirInstancia('tenant-1', 'apikey-1')).rejects.toBeInstanceOf(
      ErroEvolutionApi,
    );
  });

  it('envia texto e mídia usando o apikey da instância', async () => {
    const chamadas: { url: string; corpo: unknown }[] = [];
    const executarFetch: typeof fetch = (entrada, opcoes) => {
      chamadas.push({
        url: entrada as string,
        corpo: JSON.parse(opcoes?.body as string) as unknown,
      });
      return Promise.resolve(resposta({ key: { id: 'evo-msg-1' } }));
    };
    const servico = new EvolutionApiService(
      'https://evolution.test',
      'g',
      'http://api.test',
      executarFetch,
    );

    await expect(
      servico.enviarTexto('tenant-1', 'apikey-1', '+5511999999999', 'Olá'),
    ).resolves.toBe('evo-msg-1');
    expect(chamadas[0]).toEqual({
      url: 'https://evolution.test/message/sendText/tenant-1',
      corpo: { number: '+5511999999999', text: 'Olá' },
    });

    await expect(
      servico.enviarMidia('tenant-1', 'apikey-1', '+5511999999999', {
        tipo: 'image',
        url: 'https://exemplo.test/arquivo.png',
        nomeArquivo: 'arquivo.png',
      }),
    ).resolves.toBe('evo-msg-1');
    expect(chamadas[1]).toEqual({
      url: 'https://evolution.test/message/sendMedia/tenant-1',
      corpo: {
        number: '+5511999999999',
        mediatype: 'image',
        media: 'https://exemplo.test/arquivo.png',
        fileName: 'arquivo.png',
      },
    });
  });

  it('propaga falha de rede como erro transitório', async () => {
    const executarFetch = vi.fn().mockRejectedValue(new Error('timeout'));
    const servico = new EvolutionApiService(
      'https://evolution.test',
      'g',
      'http://api.test',
      executarFetch,
    );

    const erro = await servico
      .enviarTexto('tenant-1', 'apikey-1', '+5511999999999', 'Olá')
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroEvolutionApi);
    expect((erro as ErroEvolutionApi).codigo).toBe('EVOLUTION_INDISPONIVEL');
    expect((erro as ErroEvolutionApi).transitorio).toBe(true);
  });

  it('classifica 5xx/429 como transitório e os demais como permanente', async () => {
    const servico500 = new EvolutionApiService(
      'https://evolution.test',
      'g',
      'http://api.test',
      vi.fn().mockResolvedValue(resposta({}, 500)),
    );
    const erro500 = await servico500
      .enviarTexto('tenant-1', 'apikey-1', '+5511999999999', 'Olá')
      .catch((e: unknown) => e);
    expect(erro500).toMatchObject({ codigo: 'EVOLUTION_HTTP_500', transitorio: true });

    const servico400 = new EvolutionApiService(
      'https://evolution.test',
      'g',
      'http://api.test',
      vi.fn().mockResolvedValue(resposta({}, 400)),
    );
    const erro400 = await servico400
      .enviarTexto('tenant-1', 'apikey-1', '+5511999999999', 'Olá')
      .catch((e: unknown) => e);
    expect(erro400).toMatchObject({ codigo: 'EVOLUTION_HTTP_400', transitorio: false });
  });
});

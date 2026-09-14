import { z } from 'zod';

/**
 * Cliente para a Evolution API (self-hosted, protocolo não oficial via
 * Baileys) — ver decisão em docs/ARQUITETURA-BACKEND.md (seção 1.2).
 *
 * Contrato validado manualmente contra uma instância real
 * `evoapicloud/evolution-api:v2.3.7` durante a implementação: autenticação
 * por header `apikey` (chave global para operações administrativas, chave
 * da própria instância para operações de mensagem), instâncias identificadas
 * por `instanceName`, QR code retornado inline na criação em
 * `qrcode.base64`.
 */

export class ErroEvolutionApi extends Error {
  public constructor(
    public readonly codigo: string,
    public readonly transitorio: boolean,
  ) {
    super('Não foi possível concluir a operação na Evolution API');
  }
}

const respostaCriarInstanciaSchema = z.object({
  instance: z.object({
    instanceName: z.string().min(1),
    instanceId: z.string().min(1),
    status: z.string(),
  }),
  hash: z.string().min(1),
  qrcode: z
    .object({
      base64: z.string().min(1).optional(),
      pairingCode: z.string().nullable().optional(),
    })
    .optional(),
});

const respostaConectarSchema = z.object({
  base64: z.string().min(1).optional(),
  pairingCode: z.string().nullable().optional(),
  code: z.string().optional(),
});

const respostaEstadoConexaoSchema = z.object({
  instance: z.object({
    instanceName: z.string(),
    state: z.enum(['open', 'connecting', 'close']),
  }),
});

const respostaEnvioTextoSchema = z.object({
  key: z.object({ id: z.string().min(1) }),
});

export interface InstanciaCriada {
  instanceId: string;
  apiKey: string;
  qrCodeBase64?: string;
}

export interface EstadoConexaoInstancia {
  estado: 'open' | 'connecting' | 'close';
}

export class EvolutionApiService {
  public constructor(
    private readonly urlBase: string,
    private readonly apiKeyGlobal: string,
    private readonly urlWebhook: string,
    private readonly executarFetch: typeof fetch = fetch,
  ) {}

  public async criarInstancia(instanceName: string): Promise<InstanciaCriada> {
    const resposta = await this.requisitar('/instance/create', this.apiKeyGlobal, {
      method: 'POST',
      body: {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      },
    });
    const dados = respostaCriarInstanciaSchema.parse(await resposta.json());
    await this.configurarWebhook(instanceName, dados.hash);
    return {
      instanceId: dados.instance.instanceId,
      apiKey: dados.hash,
      ...(dados.qrcode?.base64 ? { qrCodeBase64: dados.qrcode.base64 } : {}),
    };
  }

  public async reconectar(
    instanceName: string,
    apiKey: string,
  ): Promise<{ qrCodeBase64?: string }> {
    const resposta = await this.requisitar(
      `/instance/connect/${encodeURIComponent(instanceName)}`,
      apiKey,
      { method: 'GET' },
    );
    const dados = respostaConectarSchema.parse(await resposta.json());
    return dados.base64 ? { qrCodeBase64: dados.base64 } : {};
  }

  public async obterEstadoConexao(
    instanceName: string,
    apiKey: string,
  ): Promise<EstadoConexaoInstancia> {
    const resposta = await this.requisitar(
      `/instance/connectionState/${encodeURIComponent(instanceName)}`,
      apiKey,
      { method: 'GET' },
    );
    const dados = respostaEstadoConexaoSchema.parse(await resposta.json());
    return { estado: dados.instance.state };
  }

  public async desconectar(instanceName: string, apiKey: string): Promise<void> {
    await this.requisitar(`/instance/logout/${encodeURIComponent(instanceName)}`, apiKey, {
      method: 'DELETE',
      // A Evolution responde 400 "instance is not connected" quando a sessão já
      // caiu sozinha (ex.: WhatsApp derrubou remotamente) antes do clique em
      // "Desconectar" — o estado desejado (desconectado) já foi alcançado, então
      // isso é sucesso, não erro. 404 é a instância nem existir mais na Evolution.
      ignorarStatus: [400, 404],
    });
  }

  public async excluirInstancia(instanceName: string, apiKey: string): Promise<void> {
    await this.requisitar(`/instance/delete/${encodeURIComponent(instanceName)}`, apiKey, {
      method: 'DELETE',
      ignorarStatus: [404],
    });
  }

  public async enviarTexto(
    instanceName: string,
    apiKey: string,
    numero: string,
    texto: string,
  ): Promise<string> {
    const resposta = await this.requisitar(
      `/message/sendText/${encodeURIComponent(instanceName)}`,
      apiKey,
      { method: 'POST', body: { number: numero, text: texto } },
    );
    const dados = respostaEnvioTextoSchema.parse(await resposta.json());
    return dados.key.id;
  }

  public async enviarMidia(
    instanceName: string,
    apiKey: string,
    numero: string,
    midia: { tipo: 'image' | 'video' | 'document' | 'audio'; url: string; nomeArquivo?: string },
  ): Promise<string> {
    const resposta = await this.requisitar(
      `/message/sendMedia/${encodeURIComponent(instanceName)}`,
      apiKey,
      {
        method: 'POST',
        body: {
          number: numero,
          mediatype: midia.tipo,
          media: midia.url,
          ...(midia.nomeArquivo ? { fileName: midia.nomeArquivo } : {}),
        },
      },
    );
    const dados = respostaEnvioTextoSchema.parse(await resposta.json());
    return dados.key.id;
  }

  private async configurarWebhook(instanceName: string, apiKey: string): Promise<void> {
    await this.requisitar(`/webhook/set/${encodeURIComponent(instanceName)}`, apiKey, {
      method: 'POST',
      body: {
        webhook: {
          url: this.urlWebhook,
          enabled: true,
          events: ['CONNECTION_UPDATE', 'MESSAGES_UPSERT'],
        },
      },
    });
  }

  private async requisitar(
    caminho: string,
    apiKey: string,
    opcoes: { method: string; body?: unknown; ignorarStatus?: number[] },
  ): Promise<Response> {
    let resposta: Response;
    try {
      resposta = await this.executarFetch(`${this.urlBase}${caminho}`, {
        method: opcoes.method,
        headers: {
          apikey: apiKey,
          ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(opcoes.body ? { body: JSON.stringify(opcoes.body) } : {}),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ErroEvolutionApi('EVOLUTION_INDISPONIVEL', true);
    }
    if (opcoes.ignorarStatus?.includes(resposta.status)) {
      return resposta;
    }
    if (!resposta.ok) {
      const transitorio = resposta.status === 429 || resposta.status >= 500;
      throw new ErroEvolutionApi(`EVOLUTION_HTTP_${String(resposta.status)}`, transitorio);
    }
    return resposta;
  }
}

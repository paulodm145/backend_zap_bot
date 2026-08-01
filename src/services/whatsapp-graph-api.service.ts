import { z } from 'zod';

const respostaTelefoneSchema = z.object({
  id: z.string(),
  display_phone_number: z.string().optional(),
  verified_name: z.string().optional(),
});
const respostaEnvioSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).min(1),
});

export class ErroEnvioWhatsapp extends Error {
  public constructor(
    public readonly codigo: string,
    public readonly transitorio: boolean,
  ) {
    super('Não foi possível enviar a mensagem pelo WhatsApp');
  }
}

export interface MensagemGraphApi {
  destinatario: string;
  tipo: 'TEXTO' | 'IMAGEM' | 'AUDIO' | 'DOCUMENTO';
  texto?: string;
  midiaUrl?: string;
  midiaNome?: string;
}

export interface ResultadoValidacaoWhatsapp {
  valida: boolean;
  numeroExibicao?: string;
  codigoErro?: string;
  mensagemErro?: string;
}

export class WhatsappGraphApiService {
  public constructor(
    private readonly urlBase: string,
    private readonly executarFetch: typeof fetch = fetch,
  ) {}

  public async validar(
    phoneNumberId: string,
    versao: string,
    accessToken: string,
  ): Promise<ResultadoValidacaoWhatsapp> {
    try {
      const resposta = await this.executarFetch(
        `${this.urlBase}/${versao}/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name`,
        {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!resposta.ok) {
        return {
          valida: false,
          codigoErro: `META_HTTP_${String(resposta.status)}`,
          mensagemErro: 'A Meta recusou as credenciais informadas',
        };
      }
      const dados = respostaTelefoneSchema.parse(await resposta.json());
      if (dados.id !== phoneNumberId) {
        return {
          valida: false,
          codigoErro: 'PHONE_NUMBER_ID_DIVERGENTE',
          mensagemErro: 'A credencial não pertence ao número informado',
        };
      }
      return {
        valida: true,
        ...(dados.display_phone_number ? { numeroExibicao: dados.display_phone_number } : {}),
      };
    } catch {
      return {
        valida: false,
        codigoErro: 'META_INDISPONIVEL',
        mensagemErro: 'Não foi possível validar a conta na Meta',
      };
    }
  }

  public async enviar(
    phoneNumberId: string,
    versao: string,
    accessToken: string,
    mensagem: MensagemGraphApi,
  ): Promise<string> {
    let resposta: Response;
    try {
      resposta = await this.executarFetch(
        `${this.urlBase}/${versao}/${encodeURIComponent(phoneNumberId)}/messages`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(this.corpoMensagem(mensagem)),
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new ErroEnvioWhatsapp('META_INDISPONIVEL', true);
    }
    if (!resposta.ok) {
      const transitorio = resposta.status === 429 || resposta.status >= 500;
      throw new ErroEnvioWhatsapp(`META_HTTP_${String(resposta.status)}`, transitorio);
    }
    const [mensagemEnviada] = respostaEnvioSchema.parse(await resposta.json()).messages;
    if (!mensagemEnviada) throw new ErroEnvioWhatsapp('META_RESPOSTA_INVALIDA', false);
    return mensagemEnviada.id;
  }

  private corpoMensagem(mensagem: MensagemGraphApi): Record<string, unknown> {
    const base = { messaging_product: 'whatsapp', to: mensagem.destinatario };
    if (mensagem.tipo === 'TEXTO') return { ...base, type: 'text', text: { body: mensagem.texto } };
    const tipo = mensagem.tipo.toLowerCase();
    return {
      ...base,
      type: tipo,
      [tipo]: {
        link: mensagem.midiaUrl,
        ...(mensagem.midiaNome ? { filename: mensagem.midiaNome } : {}),
      },
    };
  }
}

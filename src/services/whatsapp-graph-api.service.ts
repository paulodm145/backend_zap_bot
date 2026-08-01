import { z } from 'zod';

const respostaTelefoneSchema = z.object({
  id: z.string(),
  display_phone_number: z.string().optional(),
  verified_name: z.string().optional(),
});

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
}

import type { WebhookWhatsappEntrada } from '../dtos/webhook-whatsapp.dto.js';
import { NaoEncontradoError } from '../erros/erro-aplicacao.js';
import { criarChaveIdempotenciaMensagem } from '../helpers/chave-redis.helper.js';
import type { EnfileiradorMensagem } from './enfileirador-mensagem.service.js';

interface RoteamentoWhatsapp {
  buscarTenantAtivo(phoneNumberId: string): Promise<{
    tenant: {
      public_id: string;
      status: string;
      deletado_at: Date | null;
    };
  } | null>;
}

interface RepositorioIdempotencia {
  reservar(chave: string, expiracaoSegundos: number): Promise<boolean>;
  liberar(chave: string): Promise<void>;
}

export interface ResultadoWebhookWhatsapp {
  recebidas: number;
  duplicadas: number;
}

export class WebhookWhatsappService {
  public constructor(
    private readonly roteamentos: RoteamentoWhatsapp,
    private readonly idempotencia: RepositorioIdempotencia,
    private readonly enfileirador: EnfileiradorMensagem,
    private readonly expiracaoIdempotenciaSegundos: number,
  ) {}

  public async receber(entrada: WebhookWhatsappEntrada): Promise<ResultadoWebhookWhatsapp> {
    let recebidas = 0;
    let duplicadas = 0;

    for (const item of entrada.entry) {
      for (const alteracao of item.changes) {
        const mensagens = alteracao.value.messages ?? [];
        if (mensagens.length === 0) continue;

        const phoneNumberId = alteracao.value.metadata.phone_number_id;
        const roteamento = await this.roteamentos.buscarTenantAtivo(phoneNumberId);
        if (roteamento?.tenant.status !== 'ATIVO' || roteamento.tenant.deletado_at !== null) {
          throw new NaoEncontradoError('Conta WhatsApp ativa não encontrada');
        }

        for (const mensagem of mensagens) {
          const tenantId = roteamento.tenant.public_id;
          const chave = criarChaveIdempotenciaMensagem(tenantId, mensagem.id);
          const reservada = await this.idempotencia.reservar(
            chave,
            this.expiracaoIdempotenciaSegundos,
          );

          if (!reservada) {
            duplicadas += 1;
            continue;
          }

          try {
            await this.enfileirador.adicionar(
              {
                tenantId,
                phoneNumberId,
                mensagemId: mensagem.id,
                remetente: mensagem.from,
                timestamp: mensagem.timestamp,
                tipo: mensagem.type,
                texto: mensagem.text.body,
              },
              chave,
            );
            recebidas += 1;
          } catch (erro) {
            await this.idempotencia.liberar(chave);
            throw erro;
          }
        }
      }
    }

    return { recebidas, duplicadas };
  }
}

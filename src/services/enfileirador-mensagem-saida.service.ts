import type { Queue } from 'bullmq';
import { criarJobId } from '../helpers/chave-redis.helper.js';
import type { JobMensagemSaida } from '../types/jobs.js';
import type { EnfileiradorMensagemSaida } from './mensagem-atendimento.service.js';

export class EnfileiradorMensagemSaidaBullMqService implements EnfileiradorMensagemSaida {
  public constructor(private readonly fila: Queue<JobMensagemSaida>) {}
  public async adicionar(tenantId: string, mensagemPublicId: string): Promise<void> {
    await this.fila.add(
      'enviar-mensagem-whatsapp',
      { tenantId, mensagemPublicId },
      { jobId: criarJobId(`${tenantId}:${mensagemPublicId}`) },
    );
  }
}

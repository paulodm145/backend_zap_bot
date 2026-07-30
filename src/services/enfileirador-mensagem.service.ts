import type { Queue } from 'bullmq';

import { criarJobId } from '../helpers/chave-redis.helper.js';
import type { JobMensagemRecebida } from '../types/jobs.js';

export interface EnfileiradorMensagem {
  adicionar(dados: JobMensagemRecebida, chaveIdempotencia: string): Promise<void>;
}

export class EnfileiradorMensagemBullMqService implements EnfileiradorMensagem {
  public constructor(private readonly fila: Queue<JobMensagemRecebida>) {}

  public async adicionar(dados: JobMensagemRecebida, chaveIdempotencia: string): Promise<void> {
    await this.fila.add('processar-mensagem-recebida', dados, {
      jobId: criarJobId(chaveIdempotencia),
    });
  }
}

import { randomUUID } from 'node:crypto';
import type { Queue } from 'bullmq';
import type { JobEmail } from '../types/jobs.js';

export interface EnfileiradorEmail {
  adicionar(dados: JobEmail): Promise<void>;
}

export class EnfileiradorEmailBullMqService implements EnfileiradorEmail {
  public constructor(private readonly fila: Queue<JobEmail>) {}

  public async adicionar(dados: JobEmail): Promise<void> {
    await this.fila.add('enviar-email-transacional', dados, { jobId: randomUUID() });
  }
}

export class EnfileiradorEmailLocal implements EnfileiradorEmail {
  public adicionar(dados: JobEmail): Promise<void> {
    void dados;
    return Promise.resolve();
  }
}

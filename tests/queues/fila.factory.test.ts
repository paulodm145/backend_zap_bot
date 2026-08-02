import '../configurar-ambiente.js';

import { describe, expect, it } from 'vitest';

import { NOMES_FILAS, OPCOES_EMAIL_JOB, OPCOES_PADRAO_JOB } from '../../src/config/filas.js';
import { criarFila } from '../../src/queues/fila.factory.js';
import type { JobMensagemRecebida } from '../../src/types/jobs.js';

describe('factory de filas', () => {
  it('configura retry exponencial e retenção padronizada', async () => {
    const fila = criarFila<JobMensagemRecebida>(NOMES_FILAS.mensagensRecebidas, {
      host: '127.0.0.1',
      port: 6379,
    });

    expect(fila.opts.defaultJobOptions).toMatchObject({
      attempts: 5,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: { age: 86_400, count: 1_000 },
      removeOnFail: { age: 2_592_000, count: 5_000 },
    });
    expect(OPCOES_PADRAO_JOB.attempts).toBe(5);
    expect(OPCOES_EMAIL_JOB).toMatchObject({
      attempts: 5,
      removeOnComplete: true,
      removeOnFail: { age: 3_600, count: 1_000 },
    });
    await fila.close();
  });
});

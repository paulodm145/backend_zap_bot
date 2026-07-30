import { Queue, type ConnectionOptions, type QueueOptions } from 'bullmq';

import { OPCOES_PADRAO_JOB } from '../config/filas.js';
import type { JobComTenant } from '../types/jobs.js';

export function criarFila<TJob extends JobComTenant>(
  nome: string,
  conexao: ConnectionOptions,
  opcoes: Omit<QueueOptions, 'connection'> = {},
): Queue<TJob> {
  return new Queue<TJob>(nome, {
    ...opcoes,
    connection: conexao,
    defaultJobOptions: {
      ...OPCOES_PADRAO_JOB,
      ...opcoes.defaultJobOptions,
    },
  });
}

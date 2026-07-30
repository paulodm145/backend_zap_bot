import { Worker, type ConnectionOptions, type Processor, type WorkerOptions } from 'bullmq';
import type { ZodType } from 'zod';

import type { JobComTenant } from '../types/jobs.js';

export function criarWorker<TJob extends JobComTenant, TResult = unknown>(
  nomeFila: string,
  schema: ZodType<TJob>,
  processador: Processor<TJob, TResult>,
  conexao: ConnectionOptions,
  opcoes: Omit<WorkerOptions, 'connection'> = {},
): Worker<TJob, TResult> {
  return new Worker<TJob, TResult>(
    nomeFila,
    async (job, token) => {
      schema.parse(job.data);
      return processador(job, token);
    },
    {
      ...opcoes,
      connection: conexao,
    },
  );
}

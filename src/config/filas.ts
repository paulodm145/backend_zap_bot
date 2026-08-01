import type { JobsOptions } from 'bullmq';

export const NOMES_FILAS = {
  mensagensRecebidas: 'mensagens-recebidas',
  mensagensWhatsapp: 'mensagens-whatsapp',
  statusWhatsapp: 'status-whatsapp',
  integracoesExternas: 'integracoes-externas',
} as const;

export const OPCOES_PADRAO_JOB = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1_000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 1_000,
  },
  removeOnFail: {
    age: 30 * 24 * 60 * 60,
    count: 5_000,
  },
} satisfies JobsOptions;

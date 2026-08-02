import '../configurar-ambiente.js';
import { randomUUID } from 'node:crypto';
import { QueueEvents } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarConexaoRedis } from '../../src/config/redis.js';
import { criarFila } from '../../src/queues/fila.factory.js';
import { EnfileiradorEmailBullMqService } from '../../src/services/enfileirador-email.service.js';
import { EnviadorEmailSmtp } from '../../src/services/enviador-email.service.js';
import { ProcessadorEmailService } from '../../src/services/processador-email.service.js';
import { TemplateEmailService } from '../../src/services/template-email.service.js';
import { jobEmailSchema, type JobEmail } from '../../src/types/jobs.js';
import { criarWorker } from '../../src/workers/worker.factory.js';

const redisUrl = process.env.TEST_REDIS_URL;
const smtpHost = process.env.TEST_SMTP_HOST;
const descreverIntegracao = redisUrl && smtpHost ? describe : describe.skip;

descreverIntegracao('worker de e-mail', () => {
  const nomeFila = `teste-email-${randomUUID()}`;
  const conexaoFila = criarConexaoRedis(redisUrl ?? '', 'teste-email-fila');
  const conexaoWorker = criarConexaoRedis(redisUrl ?? '', 'teste-email-worker');
  const conexaoEventos = criarConexaoRedis(redisUrl ?? '', 'teste-email-eventos');
  const fila = criarFila<JobEmail>(nomeFila, conexaoFila);
  const eventos = new QueueEvents(nomeFila, { connection: conexaoEventos });
  const processador = new ProcessadorEmailService(
    new TemplateEmailService(),
    new EnviadorEmailSmtp({
      host: smtpHost ?? '127.0.0.1',
      porta: Number(process.env.TEST_SMTP_PORTA ?? '1025'),
      seguro: false,
      remetente: 'nao-responda@localhost.test',
    }),
  );
  const worker = criarWorker(
    nomeFila,
    jobEmailSchema,
    async (job) => processador.processar(job.data),
    conexaoWorker,
  );

  beforeAll(async () => Promise.all([eventos.waitUntilReady(), worker.waitUntilReady()]));

  afterAll(async () => {
    await Promise.all([worker.close(), eventos.close(), fila.close()]);
    for (const conexao of [conexaoFila, conexaoWorker, conexaoEventos]) {
      if (conexao.status === 'wait') conexao.disconnect();
      else await conexao.quit();
    }
  });

  it('consome o job BullMQ e entrega o template pelo SMTP', async () => {
    const destinatario = `fila-${randomUUID()}@localhost.test`;
    const jobFinalizado = eventos.waitUntilReady().then(
      () =>
        new Promise<string>((resolver) => {
          eventos.once('completed', ({ jobId }) => {
            resolver(jobId);
          });
        }),
    );
    await new EnfileiradorEmailBullMqService(fila).adicionar({
      tenantId: '11111111-1111-4111-8111-111111111111',
      tipo: 'RECUPERACAO_SENHA',
      destinatario,
      dados: {
        nome: 'Teste da fila',
        urlRedefinicao: 'http://localhost:3001/redefinir-senha?token=teste',
        expiracaoMinutos: 30,
      },
    });
    expect(typeof (await jobFinalizado)).toBe('string');
  });
});

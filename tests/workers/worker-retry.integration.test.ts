import '../configurar-ambiente.js';

import { randomUUID } from 'node:crypto';

import { QueueEvents } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarConexaoRedis } from '../../src/config/redis.js';
import { criarFila } from '../../src/queues/fila.factory.js';
import { criarWorker } from '../../src/workers/worker.factory.js';
import { jobMensagemRecebidaSchema, type JobMensagemRecebida } from '../../src/types/jobs.js';

const redisUrl = process.env.TEST_REDIS_URL;
const descreverIntegracao = redisUrl ? describe : describe.skip;

descreverIntegracao('retry de worker com backoff', () => {
  const nomeFila = `teste-retry-${randomUUID()}`;
  const conexaoFila = criarConexaoRedis(redisUrl ?? '', 'teste-fila');
  const conexaoWorker = criarConexaoRedis(redisUrl ?? '', 'teste-worker');
  const conexaoEventos = criarConexaoRedis(redisUrl ?? '', 'teste-eventos');
  const fila = criarFila<JobMensagemRecebida>(nomeFila, conexaoFila);
  const eventos = new QueueEvents(nomeFila, { connection: conexaoEventos });
  let tentativas = 0;
  const worker = criarWorker(
    nomeFila,
    jobMensagemRecebidaSchema,
    () => {
      tentativas += 1;
      if (tentativas < 3) return Promise.reject(new Error('Falha transitória simulada'));
      return Promise.resolve({ processada: true });
    },
    conexaoWorker,
  );

  beforeAll(async () => {
    await Promise.all([eventos.waitUntilReady(), worker.waitUntilReady()]);
  });

  afterAll(async () => {
    await Promise.all([worker.close(), eventos.close(), fila.close()]);
    for (const conexao of [conexaoFila, conexaoWorker, conexaoEventos]) {
      if (conexao.status === 'wait') conexao.disconnect();
      else await conexao.quit();
    }
  });

  it('repete falhas transitórias usando a política exponencial', async () => {
    const inicio = performance.now();
    const job = await fila.add('processar-mensagem-recebida', {
      tenantId: '11111111-1111-4111-8111-111111111111',
      phoneNumberId: 'numero-1',
      mensagemId: 'mensagem-retry',
      remetente: '5511888888888',
      timestamp: '1785360000',
      tipo: 'text',
      texto: 'Teste',
    });

    await expect(job.waitUntilFinished(eventos, 10_000)).resolves.toEqual({
      processada: true,
    });
    expect(tentativas).toBe(3);
    expect(performance.now() - inicio).toBeGreaterThanOrEqual(2_500);
  }, 15_000);
});

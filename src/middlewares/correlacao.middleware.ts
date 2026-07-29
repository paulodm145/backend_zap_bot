import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

export const adicionarCorrelacao: RequestHandler = (requisicao, resposta, proximo) => {
  const correlationId = randomUUID();

  requisicao.correlationId = correlationId;
  resposta.setHeader('X-Correlation-Id', correlationId);
  proximo();
};

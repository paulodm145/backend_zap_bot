import type { RequestHandler } from 'express';

export function tratarAsync(handler: RequestHandler): RequestHandler {
  return (requisicao, resposta, proximo): void => {
    Promise.resolve(handler(requisicao, resposta, proximo)).catch(proximo);
  };
}

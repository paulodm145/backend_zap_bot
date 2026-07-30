import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { ValidacaoError } from '../erros/erro-aplicacao.js';

export const preservarCorpoBruto: RequestHandler = (
  requisicao: Request,
  _resposta: Response,
  proximo: NextFunction,
): void => {
  if (!Buffer.isBuffer(requisicao.body)) {
    proximo(new ValidacaoError('Corpo bruto do webhook não disponível'));
    return;
  }

  requisicao.rawBody = requisicao.body;
  proximo();
};

export const interpretarJsonDoCorpoBruto: RequestHandler = (
  requisicao: Request,
  _resposta: Response,
  proximo: NextFunction,
): void => {
  try {
    if (!requisicao.rawBody) {
      throw new Error('Corpo bruto ausente');
    }
    const corpo: unknown = JSON.parse(requisicao.rawBody.toString('utf8'));
    requisicao.body = corpo;
    proximo();
  } catch {
    proximo(new ValidacaoError('JSON do webhook inválido'));
  }
};

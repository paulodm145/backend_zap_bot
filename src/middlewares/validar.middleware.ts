import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, type ZodType } from 'zod';

import { ValidacaoError } from '../erros/erro-aplicacao.js';

type OrigemRequisicao = 'body' | 'params' | 'query';

export function validar(schema: ZodType, origem: OrigemRequisicao = 'body'): RequestHandler {
  return (requisicao: Request, _resposta: Response, proximo: NextFunction): void => {
    const resultado = schema.safeParse(requisicao[origem]);

    if (!resultado.success) {
      proximo(new ValidacaoError('Dados da requisição inválidos', z.treeifyError(resultado.error)));
      return;
    }

    requisicao[origem] = resultado.data;
    proximo();
  };
}

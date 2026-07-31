import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AcessoNegadoError, NaoAutenticadoError } from '../erros/erro-aplicacao.js';

export const exigirAdminTenant: RequestHandler = (
  requisicao: Request,
  _resposta: Response,
  proximo: NextFunction,
): void => {
  if (!requisicao.usuarioTenant) {
    proximo(new NaoAutenticadoError());
    return;
  }
  if (requisicao.usuarioTenant.papel !== 'ADMIN_TENANT') {
    proximo(new AcessoNegadoError('Apenas administradores do tenant podem realizar esta ação'));
    return;
  }
  proximo();
};

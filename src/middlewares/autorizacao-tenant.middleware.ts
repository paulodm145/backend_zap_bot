import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AcessoNegadoError, NaoAutenticadoError } from '../erros/erro-aplicacao.js';

type PapelTenant = 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE';

export function exigirPapeisTenant(...papeis: readonly PapelTenant[]): RequestHandler {
  return (requisicao: Request, _resposta: Response, proximo: NextFunction): void => {
    if (!requisicao.usuarioTenant) {
      proximo(new NaoAutenticadoError());
      return;
    }
    if (papeis.length === 0 || !papeis.includes(requisicao.usuarioTenant.papel)) {
      proximo(new AcessoNegadoError('Usuário sem permissão para realizar esta ação'));
      return;
    }
    proximo();
  };
}

export const exigirAdminTenant: RequestHandler = exigirPapeisTenant('ADMIN_TENANT');

export const exigirGestaoTenant: RequestHandler = exigirPapeisTenant('ADMIN_TENANT', 'GESTOR');

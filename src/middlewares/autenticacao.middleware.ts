import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { NaoAutenticadoError } from '../erros/erro-aplicacao.js';
import type { TokenTenantService } from '../services/token-tenant.service.js';

export function criarAutenticacaoMiddleware(tokens: TokenTenantService): RequestHandler {
  return (requisicao: Request, _resposta: Response, proximo: NextFunction): void => {
    const authorization = requisicao.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      proximo(new NaoAutenticadoError());
      return;
    }
    try {
      const payload = tokens.verificar(authorization.slice(7));
      requisicao.usuarioTenant = {
        id: payload.sub,
        email: payload.email,
        tenantId: payload.tenantId,
        papel: payload.papel,
        ...(payload.impersonacao ? { impersonacao: payload.impersonacao } : {}),
      };
      proximo();
    } catch (erro) {
      proximo(erro);
    }
  };
}

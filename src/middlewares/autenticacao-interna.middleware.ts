import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { NaoAutenticadoError } from '../erros/erro-aplicacao.js';
import type { TokenInternoService } from '../services/token-interno.service.js';

export function criarAutenticacaoInternaMiddleware(tokens: TokenInternoService): RequestHandler {
  return (requisicao: Request, _resposta: Response, proximo: NextFunction): void => {
    const authorization = requisicao.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      proximo(new NaoAutenticadoError());
      return;
    }

    try {
      const payload = tokens.verificar(authorization.slice('Bearer '.length));
      requisicao.usuarioInterno = {
        id: payload.sub,
        email: payload.email,
        papel: payload.papel,
      };
      proximo();
    } catch (erro) {
      proximo(erro);
    }
  };
}

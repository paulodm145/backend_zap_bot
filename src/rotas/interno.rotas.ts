import { Router } from 'express';

import { criarAutenticacaoInternaMiddleware } from '../middlewares/autenticacao-interna.middleware.js';
import type { TokenInternoService } from '../services/token-interno.service.js';

export function criarRotasInternas(tokens: TokenInternoService): Router {
  const rotas = Router();

  rotas.use(criarAutenticacaoInternaMiddleware(tokens));

  rotas.get('/saude', (requisicao, resposta) => {
    resposta.status(200).json({
      status: 'ok',
      escopo: 'interno',
      usuario: requisicao.usuarioInterno,
    });
  });

  return rotas;
}

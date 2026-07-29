import { Router } from 'express';

import type { ProntidaoController } from '../controllers/prontidao.controller.js';
import { tratarAsync } from '../middlewares/async.middleware.js';

export function criarRotasSaude(prontidaoController: ProntidaoController): Router {
  const rotas = Router();

  rotas.get('/saude', (_requisicao, resposta) => {
    resposta.status(200).json({ status: 'ok' });
  });
  rotas.get('/prontidao', tratarAsync(prontidaoController.verificar));

  return rotas;
}

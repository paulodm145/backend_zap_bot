import { Router } from 'express';

import type { AutenticacaoController } from '../controllers/autenticacao.controller.js';
import { loginSchema } from '../dtos/login.dto.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasAutenticacao(controller: AutenticacaoController): Router {
  const rotas = Router();
  rotas.post('/login', validar(loginSchema), tratarAsync(controller.login));
  rotas.post('/refresh', tratarAsync(controller.refresh));
  rotas.post('/logout', tratarAsync(controller.logout));
  return rotas;
}

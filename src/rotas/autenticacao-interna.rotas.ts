import { Router } from 'express';

import type { AutenticacaoInternaController } from '../controllers/autenticacao-interna.controller.js';
import { loginInternoSchema } from '../dtos/login-interno.dto.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasAutenticacaoInterna(controller: AutenticacaoInternaController): Router {
  const rotas = Router();

  rotas.post('/login', validar(loginInternoSchema), controller.login);

  return rotas;
}

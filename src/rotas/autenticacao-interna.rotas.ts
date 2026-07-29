import { Router } from 'express';

import type { AutenticacaoInternaController } from '../controllers/autenticacao-interna.controller.js';
import { loginInternoSchema } from '../dtos/login-interno.dto.js';
import { estadoInternoSchema, verificarTotpInternoSchema } from '../dtos/totp-interno.dto.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasAutenticacaoInterna(controller: AutenticacaoInternaController): Router {
  const rotas = Router();

  rotas.post('/login', validar(loginInternoSchema), tratarAsync(controller.login));
  rotas.post(
    '/2fa/configurar',
    validar(estadoInternoSchema),
    tratarAsync(controller.configurarTotp),
  );
  rotas.post(
    '/2fa/verificar',
    validar(verificarTotpInternoSchema),
    tratarAsync(controller.verificarTotp),
  );

  return rotas;
}

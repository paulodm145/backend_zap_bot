import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import type { AutenticacaoController } from '../controllers/autenticacao.controller.js';
import type { RecuperacaoSenhaController } from '../controllers/recuperacao-senha.controller.js';
import { loginSchema } from '../dtos/login.dto.js';
import { esqueciSenhaSchema, redefinirSenhaSchema } from '../dtos/recuperacao-senha.dto.js';
import { normalizarEmail } from '../helpers/email.helper.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasAutenticacao(
  controller: AutenticacaoController,
  recuperacao?: RecuperacaoSenhaController,
): Router {
  const rotas = Router();
  rotas.post('/login', validar(loginSchema), tratarAsync(controller.login));
  rotas.post('/refresh', tratarAsync(controller.refresh));
  rotas.post('/logout', tratarAsync(controller.logout));
  if (recuperacao) {
    const limite = rateLimit({
      windowMs: 15 * 60_000,
      limit: 5,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (requisicao) => {
        const corpo = requisicao.body as unknown;
        const email =
          typeof corpo === 'object' &&
          corpo !== null &&
          'email' in corpo &&
          typeof corpo.email === 'string'
            ? normalizarEmail(corpo.email)
            : 'sem-identidade';
        return `${ipKeyGenerator(requisicao.ip ?? '')}:${email}`;
      },
    });
    rotas.post(
      '/esqueci-senha',
      limite,
      validar(esqueciSenhaSchema),
      tratarAsync(recuperacao.solicitar),
    );
    rotas.post(
      '/redefinir-senha',
      validar(redefinirSenhaSchema),
      tratarAsync(recuperacao.redefinir),
    );
  }
  return rotas;
}

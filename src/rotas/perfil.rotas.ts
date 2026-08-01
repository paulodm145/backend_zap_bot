import { Router } from 'express';
import type { PerfilController } from '../controllers/perfil.controller.js';
import {
  alterarEmailPerfilSchema,
  alterarSenhaPerfilSchema,
  atualizarPerfilSchema,
} from '../dtos/perfil.dto.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasPerfil(controller: PerfilController): Router {
  const rotas = Router();
  rotas.get('/', tratarAsync(controller.buscar));
  rotas.put('/', validar(atualizarPerfilSchema), tratarAsync(controller.atualizar));
  rotas.put('/senha', validar(alterarSenhaPerfilSchema), tratarAsync(controller.alterarSenha));
  rotas.put('/email', validar(alterarEmailPerfilSchema), tratarAsync(controller.alterarEmail));
  return rotas;
}

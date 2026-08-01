import { Router } from 'express';
import type { SetorController } from '../controllers/setor.controller.js';
import {
  atualizarSetorSchema,
  criarSetorSchema,
  listarSetoresSchema,
  setorParametroSchema,
  substituirSetoresUsuarioSchema,
  usuarioSetoresParametroSchema,
} from '../dtos/setor.dto.js';
import { exigirGestaoTenant } from '../middlewares/autorizacao-tenant.middleware.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasSetores(controller: SetorController): Router {
  const rotas = Router();
  rotas.get('/', validar(listarSetoresSchema, 'query'), tratarAsync(controller.listar));
  rotas.post('/', exigirGestaoTenant, validar(criarSetorSchema), tratarAsync(controller.criar));
  rotas.get(
    '/:setorId/atendentes-elegiveis',
    exigirGestaoTenant,
    validar(setorParametroSchema, 'params'),
    tratarAsync(controller.listarAtendentesElegiveis),
  );
  rotas.get('/:setorId', validar(setorParametroSchema, 'params'), tratarAsync(controller.buscar));
  rotas.put(
    '/:setorId',
    exigirGestaoTenant,
    validar(setorParametroSchema, 'params'),
    validar(atualizarSetorSchema),
    tratarAsync(controller.atualizar),
  );
  rotas.delete(
    '/:setorId',
    exigirGestaoTenant,
    validar(setorParametroSchema, 'params'),
    tratarAsync(controller.excluir),
  );
  return rotas;
}

export function criarRotaVinculosSetores(controller: SetorController): Router {
  const rotas = Router();
  rotas.put(
    '/:usuarioId/setores',
    exigirGestaoTenant,
    validar(usuarioSetoresParametroSchema, 'params'),
    validar(substituirSetoresUsuarioSchema),
    tratarAsync(controller.substituirSetoresUsuario),
  );
  return rotas;
}

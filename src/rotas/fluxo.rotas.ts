import { Router } from 'express';

import type { FluxoController } from '../controllers/fluxo.controller.js';
import {
  atualizarFluxoSchema,
  criarFluxoSchema,
  fluxoPublicIdSchema,
  listarFluxosSchema,
  simularFluxoSchema,
} from '../dtos/fluxo.dto.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasFluxos(controller: FluxoController): Router {
  const rotas = Router();

  rotas.get('/blocos', controller.catalogoBlocos);
  rotas.get('/', validar(listarFluxosSchema, 'query'), tratarAsync(controller.listar));
  rotas.post('/', validar(criarFluxoSchema), tratarAsync(controller.criar));
  rotas.get('/:fluxoId', validar(fluxoPublicIdSchema, 'params'), tratarAsync(controller.detalhar));
  rotas.put(
    '/:fluxoId',
    validar(fluxoPublicIdSchema, 'params'),
    validar(atualizarFluxoSchema),
    tratarAsync(controller.atualizar),
  );
  rotas.delete(
    '/:fluxoId',
    validar(fluxoPublicIdSchema, 'params'),
    tratarAsync(controller.excluir),
  );
  rotas.post(
    '/:fluxoId/publicar',
    validar(fluxoPublicIdSchema, 'params'),
    tratarAsync(controller.publicar),
  );
  rotas.post(
    '/:fluxoId/simular',
    validar(fluxoPublicIdSchema, 'params'),
    validar(simularFluxoSchema),
    tratarAsync(controller.simular),
  );

  return rotas;
}

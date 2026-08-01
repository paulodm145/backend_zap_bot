import { Router } from 'express';

import type { UsuarioTenantController } from '../controllers/usuario-tenant.controller.js';
import {
  alterarStatusUsuarioTenantSchema,
  atualizarUsuarioTenantSchema,
  criarUsuarioTenantSchema,
  listarUsuariosTenantSchema,
  usuarioTenantIdSchema,
} from '../dtos/usuario-tenant.dto.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { exigirGestaoTenant } from '../middlewares/autorizacao-tenant.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasUsuariosTenant(controller: UsuarioTenantController): Router {
  const rotas = Router();
  rotas.use(exigirGestaoTenant);
  rotas.get('/', validar(listarUsuariosTenantSchema, 'query'), tratarAsync(controller.listar));
  rotas.post('/', validar(criarUsuarioTenantSchema), tratarAsync(controller.criar));
  rotas.get(
    '/:usuarioId',
    validar(usuarioTenantIdSchema, 'params'),
    tratarAsync(controller.detalhar),
  );
  rotas.put(
    '/:usuarioId',
    validar(usuarioTenantIdSchema, 'params'),
    validar(atualizarUsuarioTenantSchema),
    tratarAsync(controller.atualizar),
  );
  rotas.patch(
    '/:usuarioId/status',
    validar(usuarioTenantIdSchema, 'params'),
    validar(alterarStatusUsuarioTenantSchema),
    tratarAsync(controller.alterarStatus),
  );
  rotas.delete(
    '/:usuarioId',
    validar(usuarioTenantIdSchema, 'params'),
    tratarAsync(controller.excluir),
  );
  return rotas;
}

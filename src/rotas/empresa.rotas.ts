import { Router } from 'express';

import type { EmpresaController } from '../controllers/empresa.controller.js';
import { atualizarEmpresaSchema, consultarCepSchema } from '../dtos/empresa.dto.js';
import { exigirAdminTenant } from '../middlewares/autorizacao-tenant.middleware.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasEmpresa(controller: EmpresaController): Router {
  const rotas = Router();

  rotas.get('/', tratarAsync(controller.buscar));
  rotas.put(
    '/',
    exigirAdminTenant,
    validar(atualizarEmpresaSchema),
    tratarAsync(controller.atualizar),
  );
  rotas.get(
    '/consultar-cep/:cep',
    validar(consultarCepSchema, 'params'),
    tratarAsync(controller.consultarCep),
  );

  return rotas;
}

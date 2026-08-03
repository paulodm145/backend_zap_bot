import { Router } from 'express';

import type { TenantsInternosController } from '../controllers/tenants-internos.controller.js';
import {
  alterarPlanoTenantSchema,
  alterarStatusTenantSchema,
  listarTenantsSchema,
  provisionarTenantSchema,
  tenantPublicIdSchema,
} from '../dtos/tenant-interno.dto.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { criarAutenticacaoInternaMiddleware } from '../middlewares/autenticacao-interna.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';
import type { TokenInternoService } from '../services/token-interno.service.js';

export function criarRotasInternas(
  tokens: TokenInternoService,
  tenants: TenantsInternosController,
): Router {
  const rotas = Router();

  rotas.use(criarAutenticacaoInternaMiddleware(tokens));

  rotas.get('/saude', (requisicao, resposta) => {
    resposta.status(200).json({
      status: 'ok',
      escopo: 'interno',
      usuario: requisicao.usuarioInterno,
    });
  });
  rotas.get('/tenants', validar(listarTenantsSchema, 'query'), tratarAsync(tenants.listar));
  rotas.post('/tenants', validar(provisionarTenantSchema), tratarAsync(tenants.provisionar));
  rotas.get(
    '/tenants/:tenantId',
    validar(tenantPublicIdSchema, 'params'),
    tratarAsync(tenants.detalhar),
  );
  rotas.patch(
    '/tenants/:tenantId/status',
    validar(tenantPublicIdSchema, 'params'),
    validar(alterarStatusTenantSchema),
    tratarAsync(tenants.alterarStatus),
  );
  rotas.patch(
    '/tenants/:tenantId/plano',
    validar(tenantPublicIdSchema, 'params'),
    validar(alterarPlanoTenantSchema),
    tratarAsync(tenants.alterarPlano),
  );
  rotas.post(
    '/tenants/:tenantId/impersonar',
    validar(tenantPublicIdSchema, 'params'),
    tratarAsync(tenants.impersonar),
  );

  return rotas;
}

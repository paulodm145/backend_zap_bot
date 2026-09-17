import { Router } from 'express';
import type { CredencialIntegracaoController } from '../controllers/credencial-integracao.controller.js';
import {
  atualizarCredencialIntegracaoSchema,
  credencialIntegracaoParametroSchema,
  criarCredencialIntegracaoSchema,
  listarCredenciaisIntegracaoSchema,
} from '../dtos/credencial-integracao.dto.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { exigirGestaoTenant } from '../middlewares/autorizacao-tenant.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

/**
 * Toda a rota exige gestão do tenant: mesmo sem devolver segredo, o cadastro
 * de credenciais define quais destinos externos os fluxos podem alcançar.
 */
export function criarRotasCredenciaisIntegracao(
  controller: CredencialIntegracaoController,
): Router {
  const rotas = Router();
  rotas.get(
    '/',
    exigirGestaoTenant,
    validar(listarCredenciaisIntegracaoSchema, 'query'),
    tratarAsync(controller.listar),
  );
  rotas.post(
    '/',
    exigirGestaoTenant,
    validar(criarCredencialIntegracaoSchema),
    tratarAsync(controller.criar),
  );
  rotas.get(
    '/:integracaoId',
    exigirGestaoTenant,
    validar(credencialIntegracaoParametroSchema, 'params'),
    tratarAsync(controller.buscar),
  );
  rotas.put(
    '/:integracaoId',
    exigirGestaoTenant,
    validar(credencialIntegracaoParametroSchema, 'params'),
    validar(atualizarCredencialIntegracaoSchema),
    tratarAsync(controller.atualizar),
  );
  rotas.delete(
    '/:integracaoId',
    exigirGestaoTenant,
    validar(credencialIntegracaoParametroSchema, 'params'),
    tratarAsync(controller.desativar),
  );
  return rotas;
}

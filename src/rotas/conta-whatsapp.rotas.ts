import { Router } from 'express';

import type { ContaWhatsappController } from '../controllers/conta-whatsapp.controller.js';
import {
  alterarStatusContaWhatsappSchema,
  atualizarContaWhatsappSchema,
  contaWhatsappIdSchema,
  criarContaWhatsappSchema,
  listarContasWhatsappSchema,
  rotacionarTokenWhatsappSchema,
} from '../dtos/conta-whatsapp.dto.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { exigirAdminTenant } from '../middlewares/autorizacao-tenant.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasContasWhatsapp(controller: ContaWhatsappController): Router {
  const rotas = Router();
  rotas.use(exigirAdminTenant);
  rotas.get('/', validar(listarContasWhatsappSchema, 'query'), tratarAsync(controller.listar));
  rotas.post('/', validar(criarContaWhatsappSchema), tratarAsync(controller.criar));
  rotas.get(
    '/:contaId',
    validar(contaWhatsappIdSchema, 'params'),
    tratarAsync(controller.detalhar),
  );
  rotas.put(
    '/:contaId',
    validar(contaWhatsappIdSchema, 'params'),
    validar(atualizarContaWhatsappSchema),
    tratarAsync(controller.atualizar),
  );
  rotas.patch(
    '/:contaId/token',
    validar(contaWhatsappIdSchema, 'params'),
    validar(rotacionarTokenWhatsappSchema),
    tratarAsync(controller.rotacionarToken),
  );
  rotas.patch(
    '/:contaId/status',
    validar(contaWhatsappIdSchema, 'params'),
    validar(alterarStatusContaWhatsappSchema),
    tratarAsync(controller.alterarStatus),
  );
  rotas.post(
    '/:contaId/testar',
    validar(contaWhatsappIdSchema, 'params'),
    tratarAsync(controller.testar),
  );
  return rotas;
}

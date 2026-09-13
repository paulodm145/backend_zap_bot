import { Router } from 'express';

import type { WebhookWhatsappController } from '../controllers/webhook-whatsapp.controller.js';
import { webhookEvolutionSchema } from '../dtos/webhook-whatsapp.dto.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasWebhookWhatsapp(controller: WebhookWhatsappController): Router {
  const rotas = Router();

  rotas.post('/', validar(webhookEvolutionSchema), tratarAsync(controller.receber));

  return rotas;
}

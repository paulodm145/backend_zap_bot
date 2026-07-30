import { Router, raw } from 'express';

import type { WebhookWhatsappController } from '../controllers/webhook-whatsapp.controller.js';
import { challengeWhatsappSchema, webhookWhatsappSchema } from '../dtos/webhook-whatsapp.dto.js';
import { tratarAsync } from '../middlewares/async.middleware.js';
import { validarAssinaturaWebhook } from '../middlewares/assinatura-webhook.middleware.js';
import {
  interpretarJsonDoCorpoBruto,
  preservarCorpoBruto,
} from '../middlewares/corpo-bruto.middleware.js';
import { validar } from '../middlewares/validar.middleware.js';

export function criarRotasWebhookWhatsapp(
  controller: WebhookWhatsappController,
  appSecret: string,
): Router {
  const rotas = Router();

  rotas.get('/', validar(challengeWhatsappSchema, 'query'), controller.challenge.bind(controller));
  rotas.post(
    '/',
    raw({ type: 'application/json', limit: '1mb' }),
    preservarCorpoBruto,
    validarAssinaturaWebhook(appSecret),
    interpretarJsonDoCorpoBruto,
    validar(webhookWhatsappSchema),
    tratarAsync(controller.receber.bind(controller)),
  );

  return rotas;
}

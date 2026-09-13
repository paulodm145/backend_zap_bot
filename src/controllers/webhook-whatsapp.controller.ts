import type { Request, Response } from 'express';

import type { WebhookEvolutionEntrada } from '../dtos/webhook-whatsapp.dto.js';
import type { WebhookWhatsappService } from '../services/webhook-whatsapp.service.js';

export class WebhookWhatsappController {
  public constructor(private readonly webhook: WebhookWhatsappService) {}

  public receber = async (requisicao: Request, resposta: Response): Promise<void> => {
    const resultado = await this.webhook.receber(requisicao.body as WebhookEvolutionEntrada);
    resposta.status(200).json(resultado);
  };
}

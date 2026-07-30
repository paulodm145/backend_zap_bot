import type { Request, Response } from 'express';

import type {
  ChallengeWhatsappEntrada,
  WebhookWhatsappEntrada,
} from '../dtos/webhook-whatsapp.dto.js';
import { AcessoNegadoError } from '../erros/erro-aplicacao.js';
import type { WebhookWhatsappService } from '../services/webhook-whatsapp.service.js';

export class WebhookWhatsappController {
  public constructor(
    private readonly webhook: WebhookWhatsappService,
    private readonly verifyToken: string,
  ) {}

  public challenge(requisicao: Request, resposta: Response): void {
    const query = requisicao.query as ChallengeWhatsappEntrada;
    if (query['hub.verify_token'] !== this.verifyToken) {
      throw new AcessoNegadoError('Token de verificação do webhook inválido');
    }

    resposta.status(200).type('text/plain').send(query['hub.challenge']);
  }

  public async receber(requisicao: Request, resposta: Response): Promise<void> {
    const resultado = await this.webhook.receber(requisicao.body as WebhookWhatsappEntrada);
    resposta.status(200).json(resultado);
  }
}

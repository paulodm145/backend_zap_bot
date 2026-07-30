import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AcessoNegadoError } from '../erros/erro-aplicacao.js';
import { assinaturaWebhookValida } from '../helpers/assinatura-webhook.helper.js';

export function validarAssinaturaWebhook(segredo: string): RequestHandler {
  return (requisicao: Request, _resposta: Response, proximo: NextFunction): void => {
    const assinatura = requisicao.header('X-Hub-Signature-256');

    if (
      !assinatura ||
      !requisicao.rawBody ||
      !assinaturaWebhookValida(requisicao.rawBody, assinatura, segredo)
    ) {
      proximo(new AcessoNegadoError('Assinatura do webhook inválida'));
      return;
    }

    proximo();
  };
}

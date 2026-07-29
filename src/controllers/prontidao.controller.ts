import type { RequestHandler } from 'express';

import type { ProntidaoService } from '../services/prontidao.service.js';

export class ProntidaoController {
  public constructor(private readonly prontidao: ProntidaoService) {}

  public verificar: RequestHandler = async (_requisicao, resposta) => {
    const resultado = await this.prontidao.verificar();

    resposta.status(resultado.pronto ? 200 : 503).json({
      status: resultado.pronto ? 'pronto' : 'indisponivel',
      dependencias: resultado.dependencias,
    });
  };
}

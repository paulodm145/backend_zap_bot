import type { NextFunction, Request, Response } from 'express';

import type { LoginInternoDTO } from '../dtos/login-interno.dto.js';
import type { AutenticacaoInternaService } from '../services/autenticacao-interna.service.js';

export class AutenticacaoInternaController {
  public constructor(private readonly autenticacao: AutenticacaoInternaService) {}

  public login = async (
    requisicao: Request<object, object, LoginInternoDTO>,
    resposta: Response,
    proximo: NextFunction,
  ): Promise<void> => {
    try {
      const resultado = await this.autenticacao.login(requisicao.body);
      resposta.status(200).json(resultado);
    } catch (erro) {
      proximo(erro);
    }
  };
}

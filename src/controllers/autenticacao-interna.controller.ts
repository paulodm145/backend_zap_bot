import type { Request, Response } from 'express';

import type { LoginInternoDTO } from '../dtos/login-interno.dto.js';
import type { EstadoInternoDTO, VerificarTotpInternoDTO } from '../dtos/totp-interno.dto.js';
import type { AutenticacaoInternaService } from '../services/autenticacao-interna.service.js';

export class AutenticacaoInternaController {
  public constructor(private readonly autenticacao: AutenticacaoInternaService) {}

  public login = async (
    requisicao: Request<object, object, LoginInternoDTO>,
    resposta: Response,
  ): Promise<void> => {
    const resultado = await this.autenticacao.login(requisicao.body);
    resposta.status(200).json(resultado);
  };

  public configurarTotp = async (
    requisicao: Request<object, object, EstadoInternoDTO>,
    resposta: Response,
  ): Promise<void> => {
    resposta.status(200).json(await this.autenticacao.configurar(requisicao.body));
  };

  public verificarTotp = async (
    requisicao: Request<object, object, VerificarTotpInternoDTO>,
    resposta: Response,
  ): Promise<void> => {
    resposta.status(200).json(await this.autenticacao.verificar(requisicao.body));
  };
}

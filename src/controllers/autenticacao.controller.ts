import type { Request, Response } from 'express';

import type { LoginEntrada } from '../dtos/login.dto.js';
import {
  definirCookieRefresh,
  lerCookieRefresh,
  limparCookieRefresh,
} from '../helpers/cookie-autenticacao.helper.js';
import type { AutenticacaoService } from '../services/autenticacao.service.js';

function contexto(requisicao: Request) {
  return {
    ...(requisicao.ip ? { ip: requisicao.ip } : {}),
    ...(requisicao.headers['user-agent'] ? { userAgent: requisicao.headers['user-agent'] } : {}),
  };
}

export class AutenticacaoController {
  public constructor(private readonly autenticacao: AutenticacaoService) {}

  public login = async (requisicao: Request, resposta: Response): Promise<void> => {
    const resultado = await this.autenticacao.login(
      requisicao.body as LoginEntrada,
      contexto(requisicao),
    );
    definirCookieRefresh(resposta, resultado.refreshToken);
    resposta.status(200).json({
      accessToken: resultado.accessToken,
      usuario: resultado.usuario,
    });
  };

  public refresh = async (requisicao: Request, resposta: Response): Promise<void> => {
    const resultado = await this.autenticacao.refresh(
      lerCookieRefresh(requisicao.headers.cookie),
      contexto(requisicao),
    );
    definirCookieRefresh(resposta, resultado.refreshToken);
    resposta.status(200).json({ accessToken: resultado.accessToken });
  };

  public logout = async (requisicao: Request, resposta: Response): Promise<void> => {
    await this.autenticacao.logout(lerCookieRefresh(requisicao.headers.cookie));
    limparCookieRefresh(resposta);
    resposta.status(204).send();
  };
}

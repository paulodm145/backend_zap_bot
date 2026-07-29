import type { Request, Response } from 'express';

import { ambiente } from '../config/ambiente.js';
import type { LoginEntrada } from '../dtos/login.dto.js';
import type { AutenticacaoService } from '../services/autenticacao.service.js';

const COOKIE = 'refreshToken';
const CAMINHO_COOKIE = '/api/v1/auth';

function lerCookie(requisicao: Request): string | undefined {
  const cabecalho = requisicao.headers.cookie;
  if (!cabecalho) return undefined;
  const item = cabecalho
    .split(';')
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith(`${COOKIE}=`));
  return item ? decodeURIComponent(item.slice(COOKIE.length + 1)) : undefined;
}

function contexto(requisicao: Request) {
  return {
    ...(requisicao.ip ? { ip: requisicao.ip } : {}),
    ...(requisicao.headers['user-agent'] ? { userAgent: requisicao.headers['user-agent'] } : {}),
  };
}

function definirCookie(resposta: Response, token: string): void {
  resposta.cookie(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: CAMINHO_COOKIE,
    maxAge: ambiente.REFRESH_TOKEN_EXPIRACAO_DIAS * 86_400_000,
  });
}

export class AutenticacaoController {
  public constructor(private readonly autenticacao: AutenticacaoService) {}

  public login = async (requisicao: Request, resposta: Response): Promise<void> => {
    const resultado = await this.autenticacao.login(
      requisicao.body as LoginEntrada,
      contexto(requisicao),
    );
    definirCookie(resposta, resultado.refreshToken);
    resposta.status(200).json({
      accessToken: resultado.accessToken,
      usuario: resultado.usuario,
    });
  };

  public refresh = async (requisicao: Request, resposta: Response): Promise<void> => {
    const resultado = await this.autenticacao.refresh(lerCookie(requisicao), contexto(requisicao));
    definirCookie(resposta, resultado.refreshToken);
    resposta.status(200).json({ accessToken: resultado.accessToken });
  };

  public logout = async (requisicao: Request, resposta: Response): Promise<void> => {
    await this.autenticacao.logout(lerCookie(requisicao));
    resposta.clearCookie(COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: CAMINHO_COOKIE,
    });
    resposta.status(204).send();
  };
}

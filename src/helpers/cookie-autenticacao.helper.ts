import type { Response } from 'express';

import { ambiente } from '../config/ambiente.js';

const COOKIE_REFRESH = 'refreshToken';
const CAMINHO_COOKIE_REFRESH = '/api/v1/auth';

const opcoesCookieRefresh = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: CAMINHO_COOKIE_REFRESH,
};

export function definirCookieRefresh(resposta: Response, token: string): void {
  resposta.cookie(COOKIE_REFRESH, token, {
    ...opcoesCookieRefresh,
    maxAge: ambiente.REFRESH_TOKEN_EXPIRACAO_DIAS * 86_400_000,
  });
}

export function limparCookieRefresh(resposta: Response): void {
  resposta.clearCookie(COOKIE_REFRESH, opcoesCookieRefresh);
}

export function lerCookieRefresh(cabecalho: string | undefined): string | undefined {
  if (!cabecalho) return undefined;
  const item = cabecalho
    .split(';')
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith(`${COOKIE_REFRESH}=`));
  return item ? decodeURIComponent(item.slice(COOKIE_REFRESH.length + 1)) : undefined;
}

import jwt, { type JwtPayload } from 'jsonwebtoken';

import { NaoAutenticadoError } from '../erros/erro-aplicacao.js';

const EMISSOR = 'zapbot-api';
const AUDIENCIA = 'zapbot-tenant';

export interface UsuarioTokenTenant {
  publicId: string;
  tenantPublicId: string;
  email: string;
  papel?: 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE';
  impersonacao?: {
    operadorPublicId: string;
    sessaoPublicId: string;
  };
}

export const EXPIRACAO_MAXIMA_IMPERSONACAO_SEGUNDOS = 900;

interface PayloadTokenTenant extends JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  papel: 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE';
  tipo: 'tenant';
  impersonacao?: {
    operadorPublicId: string;
    sessaoPublicId: string;
  };
}

export class TokenTenantService {
  public constructor(
    private readonly segredo: string,
    private readonly expiracaoSegundos: number,
  ) {}

  public emitir(usuario: UsuarioTokenTenant): string {
    return this.assinar(usuario, this.expiracaoSegundos);
  }

  public emitirImpersonacao(usuario: UsuarioTokenTenant): {
    accessToken: string;
    expiraEmSegundos: number;
  } {
    if (!usuario.impersonacao) throw new Error('Metadados de impersonação são obrigatórios');
    const expiraEmSegundos = Math.min(
      this.expiracaoSegundos,
      EXPIRACAO_MAXIMA_IMPERSONACAO_SEGUNDOS,
    );
    return { accessToken: this.assinar(usuario, expiraEmSegundos), expiraEmSegundos };
  }

  private assinar(usuario: UsuarioTokenTenant, expiraEmSegundos: number): string {
    return jwt.sign(
      {
        email: usuario.email,
        tenantId: usuario.tenantPublicId,
        papel: usuario.papel ?? 'ATENDENTE',
        tipo: 'tenant',
        ...(usuario.impersonacao ? { impersonacao: usuario.impersonacao } : {}),
      },
      this.segredo,
      {
        subject: usuario.publicId,
        issuer: EMISSOR,
        audience: AUDIENCIA,
        expiresIn: expiraEmSegundos,
      },
    );
  }

  public verificar(token: string): PayloadTokenTenant {
    try {
      const payload = jwt.verify(token, this.segredo, {
        issuer: EMISSOR,
        audience: AUDIENCIA,
      });

      if (
        typeof payload === 'string' ||
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.tenantId !== 'string' ||
        !['ADMIN_TENANT', 'GESTOR', 'ATENDENTE'].includes(String(payload.papel)) ||
        payload.tipo !== 'tenant' ||
        !this.impersonacaoValida(payload.impersonacao)
      ) {
        throw new Error('Payload inválido');
      }

      return payload as PayloadTokenTenant;
    } catch {
      throw new NaoAutenticadoError('Access token inválido ou expirado');
    }
  }

  private impersonacaoValida(valor: unknown): boolean {
    if (valor === undefined) return true;
    if (typeof valor !== 'object' || valor === null) return false;
    const dados = valor as Record<string, unknown>;
    return typeof dados.operadorPublicId === 'string' && typeof dados.sessaoPublicId === 'string';
  }
}

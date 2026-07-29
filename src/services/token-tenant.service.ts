import jwt, { type JwtPayload } from 'jsonwebtoken';

import { NaoAutenticadoError } from '../erros/erro-aplicacao.js';

const EMISSOR = 'zapbot-api';
const AUDIENCIA = 'zapbot-tenant';

export interface UsuarioTokenTenant {
  publicId: string;
  tenantPublicId: string;
  email: string;
}

export class TokenTenantService {
  public constructor(
    private readonly segredo: string,
    private readonly expiracaoSegundos: number,
  ) {}

  public emitir(usuario: UsuarioTokenTenant): string {
    return jwt.sign(
      {
        email: usuario.email,
        tenantId: usuario.tenantPublicId,
        tipo: 'tenant',
      },
      this.segredo,
      {
        subject: usuario.publicId,
        issuer: EMISSOR,
        audience: AUDIENCIA,
        expiresIn: this.expiracaoSegundos,
      },
    );
  }

  public verificar(token: string): JwtPayload & {
    sub: string;
    email: string;
    tenantId: string;
    tipo: 'tenant';
  } {
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
        payload.tipo !== 'tenant'
      ) {
        throw new Error('Payload inválido');
      }

      return payload as JwtPayload & {
        sub: string;
        email: string;
        tenantId: string;
        tipo: 'tenant';
      };
    } catch {
      throw new NaoAutenticadoError('Access token inválido ou expirado');
    }
  }
}

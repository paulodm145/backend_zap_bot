import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { NaoAutenticadoError } from '../erros/erro-aplicacao.js';

const tokenInternoSchema = z.object({
  sub: z.uuid(),
  email: z.email(),
  papel: z.literal('super_admin'),
  escopo: z.literal('interno'),
});

export interface TokenInternoConfiguracao {
  segredo: string;
  expiracaoSegundos: number;
}

export class TokenInternoService {
  public constructor(private readonly configuracao: TokenInternoConfiguracao) {}

  public emitir(usuario: { id: string; email: string; papel: 'super_admin' }): string {
    return jwt.sign(
      {
        email: usuario.email,
        papel: usuario.papel,
        escopo: 'interno',
      },
      this.configuracao.segredo,
      {
        subject: usuario.id,
        expiresIn: this.configuracao.expiracaoSegundos,
        issuer: 'zapbot-api',
        audience: 'zapbot-admin',
      },
    );
  }

  public verificar(token: string): z.infer<typeof tokenInternoSchema> {
    try {
      const payload = jwt.verify(token, this.configuracao.segredo, {
        issuer: 'zapbot-api',
        audience: 'zapbot-admin',
      });

      return tokenInternoSchema.parse(payload);
    } catch {
      throw new NaoAutenticadoError('Token interno inválido ou expirado');
    }
  }
}

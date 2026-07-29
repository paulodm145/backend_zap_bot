import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { NaoAutenticadoError } from '../erros/erro-aplicacao.js';

const estadoSchema = z.object({
  sub: z.uuid(),
  finalidade: z.literal('totp'),
});

export class EstadoAutenticacaoInternaService {
  public constructor(private readonly segredo: string) {}

  public emitir(usuarioPublicId: string): string {
    return jwt.sign({ finalidade: 'totp' }, this.segredo, {
      subject: usuarioPublicId,
      issuer: 'zapbot-api',
      audience: 'zapbot-admin-2fa',
      expiresIn: 300,
    });
  }

  public verificar(token: string): z.infer<typeof estadoSchema> {
    try {
      return estadoSchema.parse(
        jwt.verify(token, this.segredo, {
          issuer: 'zapbot-api',
          audience: 'zapbot-admin-2fa',
        }),
      );
    } catch {
      throw new NaoAutenticadoError('Estado de autenticação inválido ou expirado');
    }
  }
}

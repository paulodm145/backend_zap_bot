import { z } from '../config/zod-openapi.js';
import { normalizarEmail } from '../helpers/email.helper.js';

export const loginInternoSchema = z
  .object({
    email: z
      .string()
      .trim()
      .pipe(z.email())
      .transform(normalizarEmail)
      .openapi({ example: 'admin@zapbot.com.br' }),
    senha: z.string().min(8).max(128).openapi({ example: 'senha-segura' }),
  })
  .openapi('LoginInternoEntrada');

export type LoginInternoDTO = z.infer<typeof loginInternoSchema>;

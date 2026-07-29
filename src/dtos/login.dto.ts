import { z } from '../config/zod-openapi.js';

export const loginSchema = z
  .object({
    email: z.string().trim().pipe(z.email().max(254)).openapi({ example: 'admin@empresa.com.br' }),
    senha: z.string().min(1).max(200).openapi({ example: 'senha-segura' }),
  })
  .strict()
  .openapi('LoginEntrada');

export type LoginEntrada = z.infer<typeof loginSchema>;

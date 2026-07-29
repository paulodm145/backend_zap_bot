import { z } from '../config/zod-openapi.js';

export const estadoInternoSchema = z
  .object({
    estadoToken: z.string().min(1),
  })
  .strict()
  .openapi('EstadoInternoEntrada');

export const verificarTotpInternoSchema = estadoInternoSchema
  .extend({
    codigo: z.string().regex(/^\d{6}$/),
  })
  .openapi('VerificarTotpInternoEntrada');

export type EstadoInternoDTO = z.infer<typeof estadoInternoSchema>;
export type VerificarTotpInternoDTO = z.infer<typeof verificarTotpInternoSchema>;

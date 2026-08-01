import { z } from '../config/zod-openapi.js';

export const reatribuirConversaSchema = z.object({
  setorId: z.uuid(),
  atendenteId: z.uuid().optional(),
  motivo: z.string().trim().min(3).max(500),
});

export const encerrarConversaSchema = z.object({
  motivo: z.string().trim().min(3).max(500).optional(),
  devolverAoBot: z.boolean().default(false),
});

export type ReatribuirConversaEntrada = z.infer<typeof reatribuirConversaSchema>;
export type EncerrarConversaEntrada = z.infer<typeof encerrarConversaSchema>;

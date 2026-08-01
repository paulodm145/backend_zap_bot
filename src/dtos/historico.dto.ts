import { z } from '../config/zod-openapi.js';
import { paginacaoSchema } from './paginacao.dto.js';

export const listarContatosSchema = paginacaoSchema.extend({
  busca: z.string().trim().min(1).max(150).optional(),
});
export const listarConversasSchema = paginacaoSchema.extend({
  busca: z.string().trim().min(1).max(150).optional(),
  status: z.enum(['BOT', 'AGUARDANDO_ATENDENTE', 'COM_ATENDENTE', 'ENCERRADA']).optional(),
  setorId: z.uuid().optional(),
  atendenteId: z.uuid().optional(),
  contaId: z.uuid().optional(),
});
export const conversaParametroSchema = z.object({ conversaId: z.uuid() });
export const listarMensagensSchema = z.object({
  take: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(500).optional(),
});
export type ListarContatosEntrada = z.infer<typeof listarContatosSchema>;
export type ListarConversasEntrada = z.infer<typeof listarConversasSchema>;
export type ListarMensagensEntrada = z.infer<typeof listarMensagensSchema>;

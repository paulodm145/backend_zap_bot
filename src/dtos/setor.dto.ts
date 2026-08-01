import { z } from '../config/zod-openapi.js';
import { paginacaoSchema } from './paginacao.dto.js';

export const listarSetoresSchema = paginacaoSchema.extend({
  busca: z.string().trim().min(1).max(100).optional(),
  ativo: z
    .enum(['true', 'false'])
    .transform((valor) => valor === 'true')
    .optional(),
});
export const setorParametroSchema = z.object({ setorId: z.uuid() });
export const usuarioSetoresParametroSchema = z.object({ usuarioId: z.uuid() });
export const criarSetorSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  descricao: z.string().trim().max(500).nullable().optional(),
});
export const atualizarSetorSchema = criarSetorSchema
  .partial()
  .refine((valor) => Object.keys(valor).length > 0);
export const substituirSetoresUsuarioSchema = z.object({
  setoresIds: z.array(z.uuid()).max(100),
});

export type ListarSetoresEntrada = z.infer<typeof listarSetoresSchema>;
export type CriarSetorEntrada = z.infer<typeof criarSetorSchema>;
export type AtualizarSetorEntrada = z.infer<typeof atualizarSetorSchema>;
export type SubstituirSetoresUsuarioEntrada = z.infer<typeof substituirSetoresUsuarioSchema>;

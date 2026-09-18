import { z } from '../config/zod-openapi.js';
import { paginacaoSchema } from './paginacao.dto.js';

export const listarContatosSchema = paginacaoSchema.extend({
  busca: z.string().trim().min(1).max(150).optional(),
  ativo: z
    .enum(['true', 'false'])
    .transform((valor) => valor === 'true')
    .optional(),
});
export const contatoParametroSchema = z.object({ contatoId: z.uuid() });
export const criarContatoSchema = z.object({
  nome: z.string().trim().min(2).max(150).nullable().optional(),
  telefone: z.string().trim().min(8).max(20),
  atributos: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const atualizarContatoSchema = criarContatoSchema
  .partial()
  .refine((valor) => Object.keys(valor).length > 0);
export const iniciarConversaContatoSchema = z.object({
  contaWhatsappId: z.uuid().optional(),
});

export type ListarContatosEntrada = z.infer<typeof listarContatosSchema>;
export type CriarContatoEntrada = z.infer<typeof criarContatoSchema>;
export type AtualizarContatoEntrada = z.infer<typeof atualizarContatoSchema>;
export type IniciarConversaContatoEntrada = z.infer<typeof iniciarConversaContatoSchema>;

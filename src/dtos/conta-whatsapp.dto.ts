import { z } from '../config/zod-openapi.js';
import { paginacaoSchema } from './paginacao.dto.js';

const identificadorMetaSchema = z.string().trim().regex(/^\d+$/).max(100);
const versaoGraphSchema = z
  .string()
  .trim()
  .regex(/^v\d+\.\d+$/)
  .max(20);

export const listarContasWhatsappSchema = paginacaoSchema.extend({
  busca: z.string().trim().max(120).optional(),
});

export const contaWhatsappIdSchema = z.object({ contaId: z.uuid() }).strict();

export const criarContaWhatsappSchema = z
  .object({
    nome: z.string().trim().min(2).max(120),
    phoneNumberId: identificadorMetaSchema,
    wabaId: identificadorMetaSchema,
    numeroExibicao: z.string().trim().min(8).max(40).optional(),
    versaoGraphApi: versaoGraphSchema.default('v23.0'),
    accessToken: z.string().trim().min(20).max(4_096),
  })
  .strict()
  .openapi('CriarContaWhatsappEntrada');

export const atualizarContaWhatsappSchema = z
  .object({
    nome: z.string().trim().min(2).max(120).optional(),
    phoneNumberId: identificadorMetaSchema.optional(),
    wabaId: identificadorMetaSchema.optional(),
    numeroExibicao: z.string().trim().min(8).max(40).nullable().optional(),
    versaoGraphApi: versaoGraphSchema.optional(),
  })
  .strict()
  .refine((entrada) => Object.keys(entrada).length > 0, 'Informe ao menos um campo');

export const rotacionarTokenWhatsappSchema = z
  .object({ accessToken: z.string().trim().min(20).max(4_096) })
  .strict();

export const alterarStatusContaWhatsappSchema = z.object({ ativo: z.boolean() }).strict();

export type ListarContasWhatsappEntrada = z.infer<typeof listarContasWhatsappSchema>;
export type CriarContaWhatsappEntrada = z.infer<typeof criarContaWhatsappSchema>;
export type AtualizarContaWhatsappEntrada = z.infer<typeof atualizarContaWhatsappSchema>;

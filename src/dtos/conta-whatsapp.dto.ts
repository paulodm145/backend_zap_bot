import { z } from '../config/zod-openapi.js';
import { paginacaoSchema } from './paginacao.dto.js';

export const listarContasWhatsappSchema = paginacaoSchema.extend({
  busca: z.string().trim().max(120).optional(),
});

export const contaWhatsappIdSchema = z.object({ contaId: z.uuid() }).strict();

export const criarContaWhatsappSchema = z
  .object({
    nome: z.string().trim().min(2).max(120),
    fluxoPublicoId: z
      .uuid()
      .optional()
      .openapi({ description: 'Fluxo publicado que responde às mensagens recebidas neste número' }),
  })
  .strict()
  .openapi('CriarContaWhatsappEntrada');

export const atualizarContaWhatsappSchema = z
  .object({
    nome: z.string().trim().min(2).max(120),
  })
  .strict()
  .openapi('AtualizarContaWhatsappEntrada');

export const alterarStatusContaWhatsappSchema = z.object({ ativo: z.boolean() }).strict();

export type ListarContasWhatsappEntrada = z.infer<typeof listarContasWhatsappSchema>;
export type CriarContaWhatsappEntrada = z.infer<typeof criarContaWhatsappSchema>;
export type AtualizarContaWhatsappEntrada = z.infer<typeof atualizarContaWhatsappSchema>;

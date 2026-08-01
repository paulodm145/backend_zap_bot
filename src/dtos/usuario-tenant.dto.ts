import { z } from '../config/zod-openapi.js';
import { paginacaoSchema } from './paginacao.dto.js';

export const papelOperacionalSchema = z.enum(['ADMIN_TENANT', 'GESTOR', 'ATENDENTE']);

export const listarUsuariosTenantSchema = paginacaoSchema.extend({
  busca: z.string().trim().max(150).optional(),
  papel: papelOperacionalSchema.optional(),
  ativo: z
    .enum(['true', 'false'])
    .transform((valor) => valor === 'true')
    .optional(),
});

export const usuarioTenantIdSchema = z.object({ usuarioId: z.uuid() }).strict();

export const criarUsuarioTenantSchema = z
  .object({
    nome: z.string().trim().min(2).max(150),
    email: z.string().trim().pipe(z.email().max(254)),
    senha: z.string().min(10).max(128),
    papel: papelOperacionalSchema,
  })
  .strict()
  .openapi('CriarUsuarioTenantEntrada');

export const atualizarUsuarioTenantSchema = z
  .object({
    nome: z.string().trim().min(2).max(150).optional(),
    email: z.string().trim().pipe(z.email().max(254)).optional(),
    papel: papelOperacionalSchema.optional(),
  })
  .strict()
  .refine((entrada) => Object.keys(entrada).length > 0, 'Informe ao menos um campo');

export const alterarStatusUsuarioTenantSchema = z.object({ ativo: z.boolean() }).strict();

export type PapelOperacional = z.infer<typeof papelOperacionalSchema>;
export type ListarUsuariosTenantEntrada = z.infer<typeof listarUsuariosTenantSchema>;
export type CriarUsuarioTenantEntrada = z.infer<typeof criarUsuarioTenantSchema>;
export type AtualizarUsuarioTenantEntrada = z.infer<typeof atualizarUsuarioTenantSchema>;

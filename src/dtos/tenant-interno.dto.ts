import { z } from '../config/zod-openapi.js';
import { paginacaoSchema } from './paginacao.dto.js';

export const statusTenantSchema = z.enum([
  'AGUARDANDO_PAGAMENTO',
  'PROVISIONANDO',
  'ATIVO',
  'SUSPENSO',
  'CANCELADO',
  'FALHA_PROVISIONAMENTO',
]);

export const listarTenantsSchema = paginacaoSchema
  .extend({
    status: statusTenantSchema.optional(),
    planoId: z.uuid().optional(),
    ordenarPor: z.enum(['nome', 'status', 'created_at', 'updated_at']).default('updated_at'),
    ordem: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .openapi('ListarTenantsConsulta');

export const tenantPublicIdSchema = z
  .object({ tenantId: z.uuid() })
  .strict()
  .openapi('TenantPublicIdParametro');

export const alterarStatusTenantSchema = z
  .object({
    status: z.enum(['ATIVO', 'SUSPENSO', 'CANCELADO']),
    confirmar: z.literal(true),
    motivo: z.string().trim().min(5).max(500),
  })
  .strict()
  .openapi('AlterarStatusTenantEntrada');

export const alterarPlanoTenantSchema = z
  .object({
    planoId: z.uuid(),
    confirmar: z.literal(true),
    motivo: z.string().trim().min(5).max(500),
  })
  .strict()
  .openapi('AlterarPlanoTenantEntrada');

export type ListarTenantsEntrada = z.infer<typeof listarTenantsSchema>;
export type AlterarStatusTenantEntrada = z.infer<typeof alterarStatusTenantSchema>;
export type AlterarPlanoTenantEntrada = z.infer<typeof alterarPlanoTenantSchema>;

export const provisionarTenantSchema = z
  .object({
    chaveIdempotencia: z.uuid(),
    nome: z.string().trim().min(2).max(150),
    planoId: z.uuid(),
    administrador: z.object({
      nome: z.string().trim().min(2).max(150),
      email: z.string().trim().pipe(z.email().max(254)),
      senha: z.string().min(12).max(128),
    }),
  })
  .strict()
  .openapi('ProvisionarTenantEntrada');

export type ProvisionarTenantEntrada = z.infer<typeof provisionarTenantSchema>;

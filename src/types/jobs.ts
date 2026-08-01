import { z } from 'zod';

export const jobComTenantSchema = z.object({
  tenantId: z.uuid(),
});

export const jobMensagemRecebidaSchema = jobComTenantSchema.extend({
  phoneNumberId: z.string().min(1),
  mensagemId: z.string().min(1),
  remetente: z.string().min(1),
  timestamp: z.string().regex(/^\d+$/),
  tipo: z.literal('text'),
  texto: z.string(),
});

export type JobComTenant = z.infer<typeof jobComTenantSchema>;
export type JobMensagemRecebida = z.infer<typeof jobMensagemRecebidaSchema>;

export const jobMensagemSaidaSchema = jobComTenantSchema.extend({
  mensagemPublicId: z.uuid(),
});
export type JobMensagemSaida = z.infer<typeof jobMensagemSaidaSchema>;
export const jobStatusWhatsappSchema = jobComTenantSchema.extend({
  mensagemId: z.string().min(1),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  codigoErro: z.string().optional(),
});
export type JobStatusWhatsapp = z.infer<typeof jobStatusWhatsappSchema>;

import { z } from '../config/zod-openapi.js';

/**
 * Envelope comum a todo evento de webhook da Evolution API. O campo `apikey`
 * é a própria apikey da instância que originou o evento — é o mecanismo de
 * autenticação usado no lugar de uma assinatura HMAC (a Evolution API não
 * assina o payload como a Meta faz com X-Hub-Signature-256). A validação
 * real acontece no service, comparando este valor com a apikey armazenada
 * (criptografada) para a instância resolvida.
 */
export const webhookEvolutionSchema = z
  .object({
    event: z.string().min(1),
    instance: z.string().min(1),
    apikey: z.string().min(1),
    data: z.unknown(),
  })
  .openapi('WebhookEvolutionEntrada');

export const dadosConexaoWhatsappSchema = z.object({
  state: z.enum(['open', 'connecting', 'close']),
  statusReason: z.number().int().optional(),
});

const chaveMensagemSchema = z.object({
  id: z.string().min(1),
  remoteJid: z.string().min(1),
  fromMe: z.boolean(),
});

export const dadosMensagemWhatsappSchema = z.object({
  key: chaveMensagemSchema,
  pushName: z.string().optional(),
  messageTimestamp: z.union([z.number(), z.string()]),
  message: z
    .object({
      conversation: z.string().optional(),
      extendedTextMessage: z.object({ text: z.string() }).optional(),
    })
    .optional(),
});

export type WebhookEvolutionEntrada = z.infer<typeof webhookEvolutionSchema>;
export type DadosConexaoWhatsapp = z.infer<typeof dadosConexaoWhatsappSchema>;
export type DadosMensagemWhatsapp = z.infer<typeof dadosMensagemWhatsappSchema>;

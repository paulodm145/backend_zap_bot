import { z } from '../config/zod-openapi.js';

export const challengeWhatsappSchema = z
  .object({
    'hub.mode': z.literal('subscribe'),
    'hub.verify_token': z.string().min(1),
    'hub.challenge': z.string().min(1),
  })
  .openapi('ChallengeWhatsappQuery');

const mensagemTextoWhatsappSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  timestamp: z.string().regex(/^\d+$/),
  type: z.literal('text'),
  text: z.object({
    body: z.string(),
  }),
});

const valorWebhookWhatsappSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({
    display_phone_number: z.string().optional(),
    phone_number_id: z.string().min(1),
  }),
  messages: z.array(mensagemTextoWhatsappSchema).optional(),
  statuses: z
    .array(
      z.object({
        id: z.string().min(1),
        status: z.enum(['sent', 'delivered', 'read', 'failed']),
        timestamp: z.string().regex(/^\d+$/),
        errors: z.array(z.object({ code: z.number().int() })).optional(),
      }),
    )
    .optional(),
});

export const webhookWhatsappSchema = z
  .object({
    object: z.literal('whatsapp_business_account'),
    entry: z
      .array(
        z.object({
          id: z.string().min(1),
          changes: z.array(
            z.object({
              field: z.literal('messages'),
              value: valorWebhookWhatsappSchema,
            }),
          ),
        }),
      )
      .min(1),
  })
  .openapi('WebhookWhatsappEntrada');

export type ChallengeWhatsappEntrada = z.infer<typeof challengeWhatsappSchema>;
export type WebhookWhatsappEntrada = z.infer<typeof webhookWhatsappSchema>;
export type MensagemTextoWhatsapp = z.infer<typeof mensagemTextoWhatsappSchema>;

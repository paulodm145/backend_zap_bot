import { z } from '../config/zod-openapi.js';

export const enviarMensagemAtendimentoSchema = z
  .object({
    tipo: z.enum(['TEXTO', 'IMAGEM', 'AUDIO', 'DOCUMENTO']),
    texto: z.string().trim().min(1).max(4096).optional(),
    midiaUrl: z.url().max(1000).optional(),
    midiaMimeType: z.string().trim().min(1).max(150).optional(),
    midiaNome: z.string().trim().min(1).max(255).optional(),
    respostaMensagemId: z.uuid().optional(),
    chaveIdempotencia: z.string().trim().min(8).max(100),
  })
  .superRefine((dados, contexto) => {
    if (dados.tipo === 'TEXTO' && !dados.texto) {
      contexto.addIssue({ code: 'custom', path: ['texto'], message: 'Texto é obrigatório' });
    }
    if (dados.tipo !== 'TEXTO' && !dados.midiaUrl) {
      contexto.addIssue({
        code: 'custom',
        path: ['midiaUrl'],
        message: 'URL da mídia é obrigatória',
      });
    }
  });

export type EnviarMensagemAtendimentoEntrada = z.infer<typeof enviarMensagemAtendimentoSchema>;

import { z } from '../config/zod-openapi.js';
import { paginacaoSchema } from './paginacao.dto.js';
import {
  MENSAGENS_URL_EXTERNA_INVALIDA,
  validarUrlExterna,
} from '../helpers/url-externa.helper.js';

export const TIPOS_AUTENTICACAO_INTEGRACAO = [
  'NENHUMA',
  'BEARER',
  'API_KEY_HEADER',
  'BASIC',
] as const;

export const tipoAutenticacaoIntegracaoSchema = z
  .enum(TIPOS_AUTENTICACAO_INTEGRACAO)
  .openapi('TipoAutenticacaoIntegracao');

const segredoSchema = z.string().min(1).max(2_048);
const nomeCabecalhoSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{1,64}$/)
  .openapi({ example: 'X-API-Key' });

/**
 * Só este objeto vai para `configuracao_encrypted`. O `tipo` é espelhado em
 * `tipo_auth` em texto puro porque não é segredo e serve para exibir a
 * credencial no editor sem precisar descriptografar nada.
 */
export const autenticacaoIntegracaoSchema = z
  .discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('NENHUMA') }).strict(),
    z.object({ tipo: z.literal('BEARER'), token: segredoSchema }).strict(),
    z
      .object({
        tipo: z.literal('API_KEY_HEADER'),
        cabecalho: nomeCabecalhoSchema,
        valor: segredoSchema,
      })
      .strict(),
    z
      .object({
        tipo: z.literal('BASIC'),
        usuario: z.string().trim().min(1).max(200),
        senha: segredoSchema,
      })
      .strict(),
  ])
  .openapi('AutenticacaoIntegracao');

const baseUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .superRefine((valor, contexto) => {
    const resultado = validarUrlExterna(valor);
    if (!resultado.valida) {
      contexto.addIssue({
        code: 'custom',
        message: MENSAGENS_URL_EXTERNA_INVALIDA[resultado.motivo],
      });
    }
  })
  .openapi({ example: 'https://api.erp-exemplo.com/v1' });

export const criarCredencialIntegracaoSchema = z
  .object({
    nome: z.string().trim().min(2).max(120),
    baseUrl: baseUrlSchema,
    autenticacao: autenticacaoIntegracaoSchema,
  })
  .strict()
  .openapi('CriarCredencialIntegracaoEntrada');

export const atualizarCredencialIntegracaoSchema = criarCredencialIntegracaoSchema
  .partial()
  .refine((valor) => Object.keys(valor).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  })
  .openapi('AtualizarCredencialIntegracaoEntrada');

export const listarCredenciaisIntegracaoSchema = paginacaoSchema.extend({
  busca: z.string().trim().min(1).max(100).optional(),
  ativo: z
    .enum(['true', 'false'])
    .transform((valor) => valor === 'true')
    .optional(),
});

export const credencialIntegracaoParametroSchema = z.object({ integracaoId: z.uuid() });

export type TipoAutenticacaoIntegracao = z.infer<typeof tipoAutenticacaoIntegracaoSchema>;
export type AutenticacaoIntegracao = z.infer<typeof autenticacaoIntegracaoSchema>;
export type CriarCredencialIntegracaoEntrada = z.infer<typeof criarCredencialIntegracaoSchema>;
export type AtualizarCredencialIntegracaoEntrada = z.infer<
  typeof atualizarCredencialIntegracaoSchema
>;
export type ListarCredenciaisIntegracaoEntrada = z.infer<typeof listarCredenciaisIntegracaoSchema>;

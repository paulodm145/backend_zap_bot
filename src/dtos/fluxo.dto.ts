import { paginacaoSchema } from './paginacao.dto.js';
import { z } from '../config/zod-openapi.js';

export const TIPOS_NO_FLUXO = [
  'mensagem',
  'captura_resposta',
  'condicao',
  'direcionar_setor',
] as const;

export const tipoNoFluxoSchema = z.enum(TIPOS_NO_FLUXO).openapi('TipoNoFluxo');

const identificadorNoSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/)
  .openapi({ example: 'inicio' });

const variavelFluxoSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_.]{0,79}$/)
  .openapi({ example: 'cliente.opcao' });

export const noMensagemSchema = z
  .object({
    id: identificadorNoSchema,
    tipo: z.literal('mensagem'),
    dados: z
      .object({
        texto: z.string().min(1).max(4_096),
      })
      .strict(),
    proximo: identificadorNoSchema.optional(),
  })
  .strict()
  .openapi('NoMensagem');

export const noCapturaSchema = z
  .object({
    id: identificadorNoSchema,
    tipo: z.literal('captura_resposta'),
    dados: z
      .object({
        variavel: variavelFluxoSchema,
        mensagem: z.string().min(1).max(4_096).optional(),
      })
      .strict(),
    proximo: identificadorNoSchema.optional(),
  })
  .strict()
  .openapi('NoCapturaResposta');

const regraCondicaoSchema = z
  .object({
    se: z.string().trim().min(1).max(300),
    entao: identificadorNoSchema,
  })
  .strict();

export const noCondicaoSchema = z
  .object({
    id: identificadorNoSchema,
    tipo: z.literal('condicao'),
    dados: z
      .object({
        regras: z.array(regraCondicaoSchema).min(1).max(20),
        padrao: identificadorNoSchema,
      })
      .strict(),
  })
  .strict()
  .openapi('NoCondicao');

export const noDirecionamentoSchema = z
  .object({
    id: identificadorNoSchema,
    tipo: z.literal('direcionar_setor'),
    dados: z
      .object({
        setorId: z.uuid(),
      })
      .strict(),
  })
  .strict()
  .openapi('NoDirecionarSetor');

export const noFluxoSchema = z
  .discriminatedUnion('tipo', [
    noMensagemSchema,
    noCapturaSchema,
    noCondicaoSchema,
    noDirecionamentoSchema,
  ])
  .openapi('NoFluxo');

export const definicaoFluxoSchema = z
  .object({
    schemaVersao: z.literal(1),
    noInicial: identificadorNoSchema,
    nos: z.array(noFluxoSchema).min(1).max(500),
  })
  .strict()
  .openapi('DefinicaoFluxo');

export const criarFluxoSchema = z
  .object({
    nome: z.string().trim().min(1).max(150),
    definicao: definicaoFluxoSchema,
  })
  .strict()
  .openapi('CriarFluxoEntrada');

export const atualizarFluxoSchema = criarFluxoSchema.openapi('AtualizarFluxoEntrada');

export const listarFluxosSchema = paginacaoSchema.extend({
  estado: z.enum(['RASCUNHO', 'PUBLICADO']).optional(),
});

export const fluxoPublicIdSchema = z.object({
  fluxoId: z.uuid(),
});

export const estadoConversaFluxoSchema = z
  .object({
    fluxoVersaoId: z.uuid(),
    noAtualId: identificadorNoSchema.nullable(),
    variaveis: z.record(z.string(), z.string()),
    aguardandoCaptura: z
      .object({
        noId: identificadorNoSchema,
        variavel: variavelFluxoSchema,
        proximo: identificadorNoSchema.optional(),
      })
      .optional(),
    setorId: z.uuid().optional(),
    concluido: z.boolean(),
    passosExecutados: z.number().int().nonnegative(),
  })
  .strict()
  .openapi('EstadoConversaFluxo');

export const simularFluxoSchema = z
  .object({
    mensagem: z.string().max(4_096).optional(),
    estado: estadoConversaFluxoSchema.optional(),
    maxPassos: z.number().int().min(1).max(100).default(50),
  })
  .strict()
  .openapi('SimularFluxoEntrada');

export type NoFluxo = z.infer<typeof noFluxoSchema>;
export type NoCondicao = z.infer<typeof noCondicaoSchema>;
export type DefinicaoFluxo = z.infer<typeof definicaoFluxoSchema>;
export type CriarFluxoEntrada = z.infer<typeof criarFluxoSchema>;
export type AtualizarFluxoEntrada = z.infer<typeof atualizarFluxoSchema>;
export type ListarFluxosEntrada = z.infer<typeof listarFluxosSchema>;
export type EstadoConversaFluxo = z.infer<typeof estadoConversaFluxoSchema>;
export type SimularFluxoEntrada = z.infer<typeof simularFluxoSchema>;

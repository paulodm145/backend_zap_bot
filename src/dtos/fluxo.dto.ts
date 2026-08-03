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

const validacaoCampoBlocoSchema = z
  .object({
    minimoCaracteres: z.number().int().nonnegative().optional(),
    maximoCaracteres: z.number().int().positive().optional(),
    minimoItens: z.number().int().nonnegative().optional(),
    maximoItens: z.number().int().positive().optional(),
    padrao: z.string().optional(),
  })
  .strict();

const fonteOpcoesCampoSchema = z
  .discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('nos_fluxo') }).strict(),
    z.object({ tipo: z.literal('variaveis_fluxo') }).strict(),
    z
      .object({
        tipo: z.literal('endpoint'),
        metodo: z.literal('GET'),
        caminho: z.string(),
        campoValor: z.string(),
        campoRotulo: z.string(),
        query: z.record(z.string(), z.string()).optional(),
      })
      .strict(),
  ])
  .openapi('FonteOpcoesCampoBlocoFluxo');

const campoBlocoFluxoSchema = z
  .object({
    caminho: z.string(),
    rotulo: z.string(),
    descricao: z.string(),
    tipo: z.enum([
      'texto_curto',
      'texto_longo',
      'variavel',
      'lista_condicoes',
      'referencia_no',
      'seletor_setor',
    ]),
    obrigatorio: z.boolean(),
    valorInicial: z.unknown().optional(),
    validacao: validacaoCampoBlocoSchema.optional(),
    fonteOpcoes: fonteOpcoesCampoSchema.optional(),
    serializacao: z.string().optional(),
  })
  .strict()
  .openapi('CampoBlocoFluxo');

const saidaBlocoFluxoSchema = z
  .object({
    chave: z.string(),
    rotulo: z.string(),
    tipo: z.enum(['unica', 'dinamica']),
    obrigatoria: z.boolean(),
    quantidadeMaxima: z.number().int().positive().nullable(),
  })
  .strict();

export const blocoCatalogoFluxoSchema = z
  .object({
    tipo: tipoNoFluxoSchema,
    nome: z.string(),
    descricao: z.string(),
    categoria: z.enum(['comunicacao', 'entrada', 'logica', 'atendimento']),
    icone: z.string(),
    comportamento: z
      .object({
        pausaExecucao: z.boolean(),
        produzSaida: z.boolean(),
        podeFinalizarFluxo: z.boolean(),
      })
      .strict(),
    campos: z.array(campoBlocoFluxoSchema),
    conexoes: z
      .object({
        aceitaEntrada: z.boolean(),
        saidas: z.array(saidaBlocoFluxoSchema),
      })
      .strict(),
    configuracaoInicial: z.record(z.string(), z.unknown()),
    exemplo: noFluxoSchema,
  })
  .strict()
  .openapi('BlocoCatalogoFluxo');

export const catalogoBlocosFluxoSchema = z
  .object({
    schemaVersao: z.literal(1),
    restricoesGrafo: z
      .object({
        maximoBlocos: z.literal(500),
        ciclosPermitidos: z.literal(false),
        padraoIdentificador: z.string(),
      })
      .strict(),
    linguagemCondicao: z
      .object({
        operadores: z.tuple([z.literal('=='), z.literal('!=')]),
        formato: z.string(),
        exemplo: z.string(),
      })
      .strict(),
    blocos: z.array(blocoCatalogoFluxoSchema).length(TIPOS_NO_FLUXO.length),
  })
  .strict()
  .openapi('CatalogoBlocosFluxoResposta');

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
export type CatalogoBlocosFluxo = z.infer<typeof catalogoBlocosFluxoSchema>;

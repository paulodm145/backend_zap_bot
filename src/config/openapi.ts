import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

import {
  atualizarFluxoSchema,
  criarFluxoSchema,
  definicaoFluxoSchema,
  estadoConversaFluxoSchema,
  fluxoPublicIdSchema,
  listarFluxosSchema,
  simularFluxoSchema,
} from '../dtos/fluxo.dto.js';
import { loginInternoSchema } from '../dtos/login-interno.dto.js';
import { loginSchema } from '../dtos/login.dto.js';
import { esqueciSenhaSchema, redefinirSenhaSchema } from '../dtos/recuperacao-senha.dto.js';
import {
  alterarEmailPerfilSchema,
  alterarSenhaPerfilSchema,
  atualizarPerfilSchema,
} from '../dtos/perfil.dto.js';
import {
  conversaParametroSchema,
  listarContatosSchema,
  listarConversasSchema,
  listarMensagensSchema,
} from '../dtos/historico.dto.js';
import {
  encerrarConversaSchema,
  reatribuirConversaSchema,
} from '../dtos/direcionamento-atendimento.dto.js';
import { enviarMensagemAtendimentoSchema } from '../dtos/mensagem-atendimento.dto.js';
import {
  atualizarSetorSchema,
  criarSetorSchema,
  listarSetoresSchema,
  setorParametroSchema,
  substituirSetoresUsuarioSchema,
  usuarioSetoresParametroSchema,
} from '../dtos/setor.dto.js';
import { atualizarEmpresaSchema, consultarCepSchema } from '../dtos/empresa.dto.js';
import {
  alterarStatusContaWhatsappSchema,
  atualizarContaWhatsappSchema,
  contaWhatsappIdSchema,
  criarContaWhatsappSchema,
  listarContasWhatsappSchema,
  rotacionarTokenWhatsappSchema,
} from '../dtos/conta-whatsapp.dto.js';
import {
  alterarStatusUsuarioTenantSchema,
  atualizarUsuarioTenantSchema,
  criarUsuarioTenantSchema,
  listarUsuariosTenantSchema,
  usuarioTenantIdSchema,
} from '../dtos/usuario-tenant.dto.js';
import {
  alterarPlanoTenantSchema,
  alterarStatusTenantSchema,
  excluirTenantDefinitivamenteSchema,
  listarTenantsSchema,
  provisionarTenantSchema,
  tenantPublicIdSchema,
} from '../dtos/tenant-interno.dto.js';
import { estadoInternoSchema, verificarTotpInternoSchema } from '../dtos/totp-interno.dto.js';
import { challengeWhatsappSchema, webhookWhatsappSchema } from '../dtos/webhook-whatsapp.dto.js';
import { z } from './zod-openapi.js';

const erroSchema = z
  .object({
    erro: z.object({
      codigo: z.string().openapi({ example: 'NAO_AUTENTICADO' }),
      mensagem: z.string().openapi({ example: 'Autenticação necessária' }),
      detalhes: z.unknown().optional(),
    }),
  })
  .openapi('ErroResposta');

const paginacaoSchema = z
  .object({
    dados: z.array(z.unknown()),
    total: z.number().int().nonnegative(),
    skip: z.number().int().nonnegative(),
    take: z.number().int().positive(),
  })
  .openapi('PaginacaoResposta');

const saudeSchema = z
  .object({
    status: z.literal('ok'),
  })
  .openapi('SaudeResposta');

const estadoDependenciaSchema = z.object({
  nome: z.string(),
  disponivel: z.boolean(),
});

const prontidaoSchema = z
  .object({
    status: z.enum(['pronto', 'indisponivel']),
    dependencias: z.array(estadoDependenciaSchema),
  })
  .openapi('ProntidaoResposta');

const loginInternoRespostaSchema = z
  .object({
    exigeSegundoFator: z.boolean(),
    exigeConfiguracao: z.boolean().optional(),
    estadoToken: z.string().optional(),
    accessToken: z.string().optional(),
  })
  .openapi('LoginInternoResposta');

const configurarTotpRespostaSchema = z.object({
  segredo: z.string(),
  qrCode: z.string(),
});

const sessaoInternaRespostaSchema = z.object({ accessToken: z.string() });

const usuarioAutenticadoSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  email: z.email(),
  tenantId: z.uuid(),
});

const loginRespostaSchema = z
  .object({
    accessToken: z.string(),
    usuario: usuarioAutenticadoSchema,
  })
  .openapi('LoginResposta');

const refreshRespostaSchema = z.object({ accessToken: z.string() }).openapi('RefreshResposta');
const assinaturaWebhookSchema = z.object({
  'x-hub-signature-256': z
    .string()
    .startsWith('sha256=')
    .openapi({ example: 'sha256=hexadecimal-calculado-sobre-o-corpo-bruto' }),
});
const webhookRespostaSchema = z
  .object({
    recebidas: z.number().int().nonnegative(),
    duplicadas: z.number().int().nonnegative(),
  })
  .openapi('WebhookWhatsappResposta');
const fluxoResumoSchema = z
  .object({
    public_id: z.uuid(),
    nome: z.string(),
    versao: z.number().int().nonnegative(),
    ativo: z.boolean(),
    possui_alteracoes_nao_publicadas: z.boolean(),
    publicado_at: z.iso.datetime().nullable(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
  })
  .openapi('FluxoResumoResposta');
const fluxoDetalheSchema = fluxoResumoSchema
  .extend({
    definicao: definicaoFluxoSchema,
    versoes: z.array(
      z.object({
        public_id: z.uuid(),
        versao: z.number().int().positive(),
        created_at: z.iso.datetime(),
      }),
    ),
  })
  .openapi('FluxoDetalheResposta');
const paginaFluxosSchema = z
  .object({
    dados: z.array(fluxoResumoSchema),
    total: z.number().int().nonnegative(),
    skip: z.number().int().nonnegative(),
    take: z.number().int().positive(),
  })
  .openapi('PaginaFluxosResposta');
const versaoFluxoSchema = z
  .object({
    public_id: z.uuid(),
    versao: z.number().int().positive(),
    definicao: definicaoFluxoSchema,
    created_at: z.iso.datetime(),
  })
  .openapi('VersaoFluxoResposta');
const saidaFluxoSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('mensagem'), texto: z.string(), noId: z.string() }),
  z.object({
    tipo: z.literal('captura'),
    mensagem: z.string().optional(),
    variavel: z.string(),
    noId: z.string(),
  }),
  z.object({
    tipo: z.literal('direcionamento'),
    setorId: z.uuid(),
    noId: z.string(),
  }),
]);
const simulacaoFluxoRespostaSchema = z.object({
  estado: estadoConversaFluxoSchema,
  saidas: z.array(saidaFluxoSchema),
});
const empresaSchema = z.object({
  public_id: z.uuid(),
  razao_social: z.string().nullable(),
  nome_fantasia: z.string().nullable(),
  cnpj: z.string().nullable(),
  email: z.string().nullable(),
  telefone: z.string().nullable(),
  site: z.string().nullable(),
  cep: z.string().nullable(),
  logradouro: z.string().nullable(),
  numero: z.string().nullable(),
  complemento: z.string().nullable(),
  bairro: z.string().nullable(),
  municipio_codigo_ibge: z.string().nullable(),
  municipio_nome: z.string().nullable(),
  uf: z.string().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
const enderecoCepSchema = z.object({
  cep: z.string(),
  uf: z.string(),
  municipio: z.string(),
  bairro: z.string().nullable().optional(),
  logradouro: z.string().nullable().optional(),
  municipioCodigoIbge: z.string().nullable().optional(),
});
const contaWhatsappSchema = z.object({
  public_id: z.uuid(),
  nome: z.string(),
  phone_number_id: z.string(),
  waba_id: z.string(),
  numero_exibicao: z.string().nullable(),
  versao_graph_api: z.string(),
  status: z.enum(['PENDENTE', 'VALIDADA', 'INVALIDA']),
  ultima_validacao_at: z.iso.datetime().nullable(),
  ultimo_erro_codigo: z.string().nullable(),
  ultimo_erro_mensagem: z.string().nullable(),
  ativo: z.boolean(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
const paginaContasWhatsappSchema = z.object({
  dados: z.array(contaWhatsappSchema),
  total: z.number().int().nonnegative(),
  skip: z.number().int().nonnegative(),
  take: z.number().int().positive(),
});
const usuarioTenantSchema = z.object({
  public_id: z.uuid(),
  usuario_central_public_id: z.uuid(),
  nome: z.string(),
  email: z.email(),
  papel: z.enum(['ADMIN_TENANT', 'GESTOR', 'ATENDENTE']),
  ativo: z.boolean(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
const paginaUsuariosTenantSchema = z.object({
  dados: z.array(usuarioTenantSchema),
  total: z.number().int().nonnegative(),
  skip: z.number().int().nonnegative(),
  take: z.number().int().positive(),
});
const setorSchema = z.object({
  public_id: z.uuid(),
  nome: z.string(),
  descricao: z.string().nullable(),
  ativo: z.boolean(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
const paginaSetoresSchema = z.object({
  dados: z.array(setorSchema),
  total: z.number().int(),
  skip: z.number().int(),
  take: z.number().int(),
});
const atendenteElegivelSchema = z.object({
  public_id: z.uuid(),
  nome: z.string(),
  email: z.email(),
  usuario: z.object({
    public_id: z.uuid(),
    papel: z.enum(['ADMIN_TENANT', 'GESTOR', 'ATENDENTE']),
  }),
});
const perfilRespostaSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  email: z.email(),
  papel: z.enum(['ADMIN_TENANT', 'GESTOR', 'ATENDENTE']),
  ativo: z.boolean(),
  tenant: z.object({ id: z.uuid(), nome: z.string(), status: z.string() }),
  permissoes: z.array(z.string()),
  setores: z.array(z.object({ public_id: z.uuid(), nome: z.string() })),
});
const contatoHistoricoSchema = z.object({
  public_id: z.uuid(),
  nome: z.string().nullable(),
  telefone: z.string(),
  atributos: z.unknown().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  _count: z.object({ conversas: z.number().int() }),
});
const conversaHistoricoSchema = z.object({
  public_id: z.uuid(),
  status: z.enum(['BOT', 'AGUARDANDO_ATENDENTE', 'COM_ATENDENTE', 'ENCERRADA']),
  ultima_mensagem_at: z.iso.datetime().nullable(),
  finalizada_at: z.iso.datetime().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  contato: z.object({ public_id: z.uuid(), nome: z.string().nullable(), telefone: z.string() }),
  setor: z.object({ public_id: z.uuid(), nome: z.string() }).nullable(),
  atendente: z.object({ public_id: z.uuid(), nome: z.string() }).nullable(),
  conta_whatsapp: z.object({
    public_id: z.uuid(),
    nome: z.string(),
    numero_exibicao: z.string().nullable(),
  }),
  mensagens: z.array(z.unknown()),
});
const mensagemHistoricoSchema = z.object({
  public_id: z.uuid(),
  whatsapp_message_id: z.string().nullable(),
  tipo: z.string(),
  direcao: z.enum(['ENTRADA', 'SAIDA', 'INTERNA']),
  autor: z.enum(['CONTATO', 'BOT', 'ATENDENTE', 'SISTEMA']),
  status_entrega: z.enum(['RECEBIDA', 'PENDENTE', 'ENVIADA', 'ENTREGUE', 'LIDA', 'FALHA']),
  conteudo: z.unknown(),
  ocorreu_at: z.iso.datetime(),
  created_at: z.iso.datetime(),
});

const atendenteDirecionamentoSchema = z
  .object({ id: z.number().int().positive(), public_id: z.uuid(), nome: z.string() })
  .openapi('AtendenteDirecionamentoResposta');
const setorDirecionamentoSchema = z
  .object({ id: z.number().int().positive(), public_id: z.uuid(), nome: z.string() })
  .openapi('SetorDirecionamentoResposta');
const assumirConversaRespostaSchema = z
  .object({
    conversaId: z.uuid(),
    status: z.literal('COM_ATENDENTE'),
    atendente: atendenteDirecionamentoSchema,
  })
  .openapi('AssumirConversaResposta');
const reatribuirConversaRespostaSchema = z
  .object({
    conversaId: z.uuid(),
    status: z.enum(['COM_ATENDENTE', 'AGUARDANDO_ATENDENTE']),
    setor: setorDirecionamentoSchema,
    atendente: atendenteDirecionamentoSchema.nullable(),
  })
  .openapi('ReatribuirConversaResposta');
const encerrarConversaRespostaSchema = z
  .object({
    conversaId: z.uuid(),
    status: z.enum(['BOT', 'ENCERRADA']),
    estadoFluxoRestaurado: z.unknown().nullable(),
  })
  .openapi('EncerrarConversaResposta');
const enviarMensagemRespostaSchema = z
  .object({
    public_id: z.uuid(),
    status_entrega: z.enum(['RECEBIDA', 'PENDENTE', 'ENVIADA', 'ENTREGUE', 'LIDA', 'FALHA']),
    duplicada: z.boolean(),
  })
  .openapi('EnviarMensagemAtendimentoResposta');
const alterarEmailRespostaSchema = z
  .object({ email: z.email() })
  .openapi('AlterarEmailPerfilResposta');
const setoresUsuarioRespostaSchema = z
  .object({ setores: z.array(setorSchema) })
  .openapi('SetoresUsuarioResposta');
const mensagemOperacaoSchema = z
  .object({ mensagem: z.string() })
  .openapi('MensagemOperacaoResposta');

const statusTenantSchema = z.enum([
  'AGUARDANDO_PAGAMENTO',
  'PROVISIONANDO',
  'ATIVO',
  'SUSPENSO',
  'CANCELADO',
  'FALHA_PROVISIONAMENTO',
]);
const planoInternoSchema = z
  .object({
    id: z.number().int().positive(),
    public_id: z.uuid(),
    nome: z.string(),
    limite_conversas_mes: z.number().int().nonnegative(),
    limite_contas_whatsapp: z.number().int().nonnegative(),
    preco_centavos: z.number().int().nonnegative(),
    ativo: z.boolean(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
  })
  .openapi('PlanoInternoResposta');
const assinaturaInternaSchema = z
  .object({
    id: z.number().int().positive(),
    tenant_id: z.number().int().positive(),
    plano_id: z.number().int().positive(),
    status: z.enum(['AGUARDANDO_PAGAMENTO', 'ATIVA', 'INADIMPLENTE', 'CANCELADA', 'MANUAL']),
    gateway_assinatura_id: z.string().nullable(),
    proxima_cobranca: z.iso.datetime().nullable(),
    cancelada_at: z.iso.datetime().nullable(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
    plano: planoInternoSchema,
  })
  .openapi('AssinaturaInternaResposta');
const tenantInternoSchema = z
  .object({
    id: z.number().int().positive(),
    public_id: z.uuid(),
    provisionamento_chave: z.uuid().nullable(),
    nome: z.string(),
    nome_do_banco: z.string().nullable(),
    string_conexao_encrypted: z.string().nullable(),
    status: statusTenantSchema,
    etapa_provisionamento: z.string().nullable(),
    erro_provisionamento: z.string().nullable(),
    deletado_at: z.iso.datetime().nullable(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
  })
  .openapi('TenantInternoResposta');
const tenantDetalheInternoSchema = tenantInternoSchema
  .extend({
    usuarios: z.array(
      z.object({
        public_id: z.uuid(),
        nome: z.string(),
        email: z.email(),
        papel: z.enum(['SUPER_ADMIN', 'ADMIN_TENANT', 'GESTOR', 'ATENDENTE']),
        ativo: z.boolean(),
      }),
    ),
    assinaturas: z.array(assinaturaInternaSchema),
  })
  .openapi('TenantDetalheInternoResposta');
const paginaTenantsInternosSchema = z
  .object({
    dados: z.array(tenantInternoSchema.extend({ assinaturas: z.array(assinaturaInternaSchema) })),
    total: z.number().int().nonnegative(),
    skip: z.number().int().nonnegative(),
    take: z.number().int().positive(),
  })
  .openapi('PaginaTenantsInternosResposta');
const saudeInternaSchema = z
  .object({
    status: z.literal('ok'),
    escopo: z.literal('interno'),
    usuario: z.object({ id: z.uuid(), email: z.email(), papel: z.literal('SUPER_ADMIN') }),
  })
  .openapi('SaudeInternaResposta');
const impersonacaoTenantRespostaSchema = z
  .object({
    accessToken: z.string(),
    usuario: z.object({
      id: z.uuid(),
      nome: z.string(),
      email: z.email(),
      tenantId: z.uuid(),
      papel: z.literal('ADMIN_TENANT'),
    }),
    impersonacao: z.object({
      ativa: z.literal(true),
      operadorId: z.uuid(),
      sessaoId: z.uuid(),
      expiraEmSegundos: z.number().int().positive().max(900),
    }),
  })
  .openapi('ImpersonacaoTenantResposta');
const documentoOpenApiSchema = z
  .object({
    openapi: z.string(),
    info: z.object({ title: z.string(), version: z.string() }).loose(),
    paths: z.record(z.string(), z.unknown()),
  })
  .loose()
  .openapi('DocumentoOpenApiResposta');

function criarRegistro(): OpenAPIRegistry {
  const registro = new OpenAPIRegistry();

  registro.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Access token enviado no header Authorization.',
  });
  registro.register('ErroResposta', erroSchema);
  registro.register('PaginacaoResposta', paginacaoSchema);

  registro.registerPath({
    method: 'get',
    path: '/api/v1/contatos',
    tags: ['Histórico'],
    summary: 'Lista contatos com paginação server-side',
    security: [{ bearerAuth: [] }],
    request: { query: listarContatosSchema },
    responses: {
      200: {
        description: 'Contatos visíveis.',
        content: {
          'application/json': {
            schema: z.object({
              dados: z.array(contatoHistoricoSchema),
              total: z.number().int(),
              skip: z.number().int(),
              take: z.number().int(),
            }),
          },
        },
      },
    },
  });
  registro.registerPath({
    method: 'get',
    path: '/api/v1/conversas',
    tags: ['Histórico'],
    summary: 'Lista e filtra conversas visíveis',
    security: [{ bearerAuth: [] }],
    request: { query: listarConversasSchema },
    responses: {
      200: {
        description: 'Conversas paginadas.',
        content: {
          'application/json': {
            schema: z.object({
              dados: z.array(conversaHistoricoSchema),
              total: z.number().int(),
              skip: z.number().int(),
              take: z.number().int(),
            }),
          },
        },
      },
    },
  });
  registro.registerPath({
    method: 'get',
    path: '/api/v1/conversas/{conversaId}',
    tags: ['Histórico'],
    summary: 'Detalha conversa e snapshot do fluxo',
    security: [{ bearerAuth: [] }],
    request: { params: conversaParametroSchema },
    responses: {
      200: {
        description: 'Detalhe da conversa.',
        content: {
          'application/json': {
            schema: conversaHistoricoSchema.extend({
              estado_fluxo: z.unknown().nullable(),
              janela_expira_at: z.iso.datetime().nullable(),
            }),
          },
        },
      },
      404: {
        description: 'Inexistente ou fora do escopo.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'get',
    path: '/api/v1/conversas/{conversaId}/mensagens',
    tags: ['Histórico'],
    summary: 'Timeline reversa com cursor temporal estável',
    security: [{ bearerAuth: [] }],
    request: { params: conversaParametroSchema, query: listarMensagensSchema },
    responses: {
      200: {
        description: 'Página cronológica e cursor para mensagens anteriores.',
        content: {
          'application/json': {
            schema: z.object({
              dados: z.array(mensagemHistoricoSchema),
              proximoCursor: z.string().nullable(),
            }),
          },
        },
      },
    },
  });
  registro.registerPath({
    method: 'post',
    path: '/api/v1/conversas/{conversaId}/assumir',
    tags: ['Atendimento'],
    summary: 'Assume atomicamente uma conversa da fila do setor',
    security: [{ bearerAuth: [] }],
    request: { params: conversaParametroSchema },
    responses: {
      200: {
        description: 'Conversa atribuída ao atendente autenticado.',
        content: { 'application/json': { schema: assumirConversaRespostaSchema } },
      },
      403: {
        description: 'Atendente sem vínculo com o setor.',
        content: { 'application/json': { schema: erroSchema } },
      },
      409: {
        description: 'Outro atendente venceu o claim.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'post',
    path: '/api/v1/conversas/{conversaId}/reatribuir',
    tags: ['Atendimento'],
    summary: 'Reatribui uma conversa com trilha de auditoria',
    security: [{ bearerAuth: [] }],
    request: {
      params: conversaParametroSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: reatribuirConversaSchema } },
      },
    },
    responses: {
      200: {
        description: 'Conversa enviada ao setor ou atendente informado.',
        content: { 'application/json': { schema: reatribuirConversaRespostaSchema } },
      },
      403: {
        description: 'Ação restrita a admin e gestor.',
        content: { 'application/json': { schema: erroSchema } },
      },
      422: {
        description: 'Atendente sem vínculo com setor de destino.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'post',
    path: '/api/v1/conversas/{conversaId}/encerrar',
    tags: ['Atendimento'],
    summary: 'Encerra a conversa ou a devolve ao snapshot do bot',
    security: [{ bearerAuth: [] }],
    request: {
      params: conversaParametroSchema,
      body: { required: true, content: { 'application/json': { schema: encerrarConversaSchema } } },
    },
    responses: {
      200: {
        description: 'Novo estado da conversa.',
        content: { 'application/json': { schema: encerrarConversaRespostaSchema } },
      },
      403: {
        description: 'Atendente não é o responsável.',
        content: { 'application/json': { schema: erroSchema } },
      },
      422: {
        description: 'Snapshot ausente ao devolver ao bot.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'post',
    path: '/api/v1/conversas/{conversaId}/mensagens',
    tags: ['Atendimento'],
    summary: 'Persiste e enfileira uma mensagem manual para o WhatsApp',
    security: [{ bearerAuth: [] }],
    request: {
      params: conversaParametroSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: enviarMensagemAtendimentoSchema } },
      },
    },
    responses: {
      202: {
        description: 'Mensagem persistida como PENDENTE e enfileirada.',
        content: { 'application/json': { schema: enviarMensagemRespostaSchema } },
      },
      200: {
        description: 'A mesma chave idempotente já havia sido persistida.',
        content: { 'application/json': { schema: enviarMensagemRespostaSchema } },
      },
      403: {
        description: 'Usuário não é o atendente responsável.',
        content: { 'application/json': { schema: erroSchema } },
      },
      422: {
        description: 'Janela expirada, conta indisponível ou payload inválido.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/me',
    tags: ['Perfil'],
    summary: 'Retorna perfil e permissões efetivas',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Perfil autenticado.',
        content: { 'application/json': { schema: perfilRespostaSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'put',
    path: '/api/v1/me',
    tags: ['Perfil'],
    summary: 'Atualiza somente dados pessoais permitidos',
    security: [{ bearerAuth: [] }],
    request: {
      body: { required: true, content: { 'application/json': { schema: atualizarPerfilSchema } } },
    },
    responses: {
      200: {
        description: 'Perfil sincronizado.',
        content: { 'application/json': { schema: perfilRespostaSchema } },
      },
      422: {
        description: 'Campo administrativo não permitido.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'put',
    path: '/api/v1/me/senha',
    tags: ['Perfil'],
    summary: 'Altera senha após reautenticação',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: alterarSenhaPerfilSchema } },
      },
    },
    responses: {
      204: { description: 'Senha alterada e sessões revogadas.' },
      401: {
        description: 'Senha atual inválida.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'put',
    path: '/api/v1/me/email',
    tags: ['Perfil'],
    summary: 'Altera e-mail em fluxo sensível separado',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: alterarEmailPerfilSchema } },
      },
    },
    responses: {
      200: {
        description: 'E-mail sincronizado; novo login necessário.',
        content: { 'application/json': { schema: alterarEmailRespostaSchema } },
      },
      409: {
        description: 'E-mail já utilizado.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/setores',
    tags: ['Setores'],
    summary: 'Lista setores visíveis ao usuário',
    security: [{ bearerAuth: [] }],
    request: { query: listarSetoresSchema },
    responses: {
      200: {
        description: 'Lista paginada.',
        content: { 'application/json': { schema: paginaSetoresSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'post',
    path: '/api/v1/setores',
    tags: ['Setores'],
    summary: 'Cria setor',
    security: [{ bearerAuth: [] }],
    request: {
      body: { required: true, content: { 'application/json': { schema: criarSetorSchema } } },
    },
    responses: {
      201: {
        description: 'Setor criado.',
        content: { 'application/json': { schema: setorSchema } },
      },
      403: {
        description: 'Sem permissão.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'get',
    path: '/api/v1/setores/{setorId}',
    tags: ['Setores'],
    summary: 'Detalha setor visível',
    security: [{ bearerAuth: [] }],
    request: { params: setorParametroSchema },
    responses: {
      200: { description: 'Setor.', content: { 'application/json': { schema: setorSchema } } },
      404: {
        description: 'Não encontrado.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'put',
    path: '/api/v1/setores/{setorId}',
    tags: ['Setores'],
    summary: 'Atualiza setor',
    security: [{ bearerAuth: [] }],
    request: {
      params: setorParametroSchema,
      body: { required: true, content: { 'application/json': { schema: atualizarSetorSchema } } },
    },
    responses: {
      200: {
        description: 'Setor atualizado.',
        content: { 'application/json': { schema: setorSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'delete',
    path: '/api/v1/setores/{setorId}',
    tags: ['Setores'],
    summary: 'Exclui setor logicamente',
    security: [{ bearerAuth: [] }],
    request: { params: setorParametroSchema },
    responses: {
      204: { description: 'Excluído.' },
      409: {
        description: 'Usado por fluxo publicado ou conversa ativa.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'get',
    path: '/api/v1/setores/{setorId}/atendentes-elegiveis',
    tags: ['Setores'],
    summary: 'Lista atendentes ativos vinculados',
    security: [{ bearerAuth: [] }],
    request: { params: setorParametroSchema },
    responses: {
      200: {
        description: 'Atendentes elegíveis.',
        content: { 'application/json': { schema: z.array(atendenteElegivelSchema) } },
      },
    },
  });
  registro.registerPath({
    method: 'put',
    path: '/api/v1/usuarios/{usuarioId}/setores',
    tags: ['Usuários', 'Setores'],
    summary: 'Substitui vínculos de setores atomicamente',
    security: [{ bearerAuth: [] }],
    request: {
      params: usuarioSetoresParametroSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: substituirSetoresUsuarioSchema } },
      },
    },
    responses: {
      200: {
        description: 'Vínculos substituídos.',
        content: { 'application/json': { schema: setoresUsuarioRespostaSchema } },
      },
      422: {
        description: 'Setor inexistente ou inativo.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'post',
    path: '/api/v1/auth/esqueci-senha',
    tags: ['Autenticação'],
    summary: 'Solicita recuperação com resposta neutra',
    request: {
      body: { required: true, content: { 'application/json': { schema: esqueciSenhaSchema } } },
    },
    responses: {
      202: {
        description: 'Solicitação aceita e e-mail enfileirado, exista ou não o endereço.',
        content: { 'application/json': { schema: mensagemOperacaoSchema } },
      },
      429: {
        description: 'Limite por IP e identidade excedido.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'post',
    path: '/api/v1/auth/redefinir-senha',
    tags: ['Autenticação'],
    summary: 'Redefine a senha com token de uso único',
    request: {
      body: { required: true, content: { 'application/json': { schema: redefinirSenhaSchema } } },
    },
    responses: {
      204: { description: 'Senha redefinida e sessões revogadas.' },
      422: {
        description: 'Token inválido, expirado ou consumido.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/usuarios',
    tags: ['Usuários'],
    summary: 'Lista usuários do tenant',
    security: [{ bearerAuth: [] }],
    request: { query: listarUsuariosTenantSchema },
    responses: {
      200: {
        description: 'Lista paginada.',
        content: { 'application/json': { schema: paginaUsuariosTenantSchema } },
      },
      403: {
        description: 'Sem permissão.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'post',
    path: '/api/v1/usuarios',
    tags: ['Usuários'],
    summary: 'Cadastra identidade central e perfil tenant',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: criarUsuarioTenantSchema } },
      },
    },
    responses: {
      201: {
        description: 'Usuário criado sem senha no response.',
        content: { 'application/json': { schema: usuarioTenantSchema } },
      },
      409: {
        description: 'E-mail global duplicado.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'get',
    path: '/api/v1/usuarios/{usuarioId}',
    tags: ['Usuários'],
    summary: 'Detalha usuário do tenant',
    security: [{ bearerAuth: [] }],
    request: { params: usuarioTenantIdSchema },
    responses: {
      200: {
        description: 'Usuário encontrado.',
        content: { 'application/json': { schema: usuarioTenantSchema } },
      },
      404: {
        description: 'Usuário não encontrado.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'put',
    path: '/api/v1/usuarios/{usuarioId}',
    tags: ['Usuários'],
    summary: 'Atualiza usuário e papel',
    security: [{ bearerAuth: [] }],
    request: {
      params: usuarioTenantIdSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: atualizarUsuarioTenantSchema } },
      },
    },
    responses: {
      200: {
        description: 'Usuário atualizado.',
        content: { 'application/json': { schema: usuarioTenantSchema } },
      },
      422: {
        description: 'Último admin ou escopo de gestor.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'patch',
    path: '/api/v1/usuarios/{usuarioId}/status',
    tags: ['Usuários'],
    summary: 'Ativa ou desativa e revoga sessões',
    security: [{ bearerAuth: [] }],
    request: {
      params: usuarioTenantIdSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: alterarStatusUsuarioTenantSchema } },
      },
    },
    responses: {
      200: {
        description: 'Status alterado.',
        content: { 'application/json': { schema: usuarioTenantSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'delete',
    path: '/api/v1/usuarios/{usuarioId}',
    tags: ['Usuários'],
    summary: 'Exclui logicamente e revoga sessões',
    security: [{ bearerAuth: [] }],
    request: { params: usuarioTenantIdSchema },
    responses: {
      204: { description: 'Usuário excluído.' },
      422: {
        description: 'Último administrador ativo.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/contas-whatsapp',
    tags: ['Contas WhatsApp'],
    summary: 'Lista as contas WhatsApp do tenant',
    security: [{ bearerAuth: [] }],
    request: { query: listarContasWhatsappSchema },
    responses: {
      200: {
        description: 'Lista paginada sem credenciais.',
        content: { 'application/json': { schema: paginaContasWhatsappSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'post',
    path: '/api/v1/contas-whatsapp',
    tags: ['Contas WhatsApp'],
    summary: 'Cadastra uma conta e sincroniza seu roteamento central',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: criarContaWhatsappSchema } },
      },
    },
    responses: {
      201: {
        description: 'Conta cadastrada sem retornar o token.',
        content: { 'application/json': { schema: contaWhatsappSchema } },
      },
      409: {
        description: 'Número vinculado a outro tenant.',
        content: { 'application/json': { schema: erroSchema } },
      },
      422: {
        description: 'Limite do plano ou dados inválidos.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'get',
    path: '/api/v1/contas-whatsapp/{contaId}',
    tags: ['Contas WhatsApp'],
    summary: 'Detalha uma conta sem expor a credencial',
    security: [{ bearerAuth: [] }],
    request: { params: contaWhatsappIdSchema },
    responses: {
      200: {
        description: 'Conta encontrada.',
        content: { 'application/json': { schema: contaWhatsappSchema } },
      },
      404: {
        description: 'Conta não encontrada.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'put',
    path: '/api/v1/contas-whatsapp/{contaId}',
    tags: ['Contas WhatsApp'],
    summary: 'Atualiza metadados e roteamento da conta',
    security: [{ bearerAuth: [] }],
    request: {
      params: contaWhatsappIdSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: atualizarContaWhatsappSchema } },
      },
    },
    responses: {
      200: {
        description: 'Conta atualizada.',
        content: { 'application/json': { schema: contaWhatsappSchema } },
      },
      409: {
        description: 'Número vinculado a outro tenant.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'patch',
    path: '/api/v1/contas-whatsapp/{contaId}/token',
    tags: ['Contas WhatsApp'],
    summary: 'Rotaciona a credencial criptografada',
    security: [{ bearerAuth: [] }],
    request: {
      params: contaWhatsappIdSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: rotacionarTokenWhatsappSchema } },
      },
    },
    responses: {
      200: {
        description: 'Token substituído; o valor nunca é retornado.',
        content: { 'application/json': { schema: contaWhatsappSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'patch',
    path: '/api/v1/contas-whatsapp/{contaId}/status',
    tags: ['Contas WhatsApp'],
    summary: 'Ativa ou desativa a conta',
    security: [{ bearerAuth: [] }],
    request: {
      params: contaWhatsappIdSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: alterarStatusContaWhatsappSchema } },
      },
    },
    responses: {
      200: {
        description: 'Status operacional alterado.',
        content: { 'application/json': { schema: contaWhatsappSchema } },
      },
    },
  });
  registro.registerPath({
    method: 'post',
    path: '/api/v1/contas-whatsapp/{contaId}/testar',
    tags: ['Contas WhatsApp'],
    summary: 'Testa a credencial diretamente na Graph API',
    security: [{ bearerAuth: [] }],
    request: { params: contaWhatsappIdSchema },
    responses: {
      200: {
        description: 'Resultado persistido sem dados secretos.',
        content: { 'application/json': { schema: contaWhatsappSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/empresa',
    tags: ['Empresa'],
    summary: 'Obtém o perfil empresarial do tenant autenticado',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Perfil preenchido ou null quando ainda não iniciado.',
        content: { 'application/json': { schema: empresaSchema.nullable() } },
      },
      401: {
        description: 'Sessão ausente ou expirada.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'put',
    path: '/api/v1/empresa',
    tags: ['Empresa'],
    summary: 'Cria ou atualiza parcialmente o perfil empresarial',
    security: [{ bearerAuth: [] }],
    request: {
      body: { required: true, content: { 'application/json': { schema: atualizarEmpresaSchema } } },
    },
    responses: {
      200: {
        description: 'Perfil salvo.',
        content: { 'application/json': { schema: empresaSchema } },
      },
      403: {
        description: 'Somente ADMIN_TENANT pode alterar.',
        content: { 'application/json': { schema: erroSchema } },
      },
      422: {
        description: 'Dados inválidos.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/empresa/consultar-cep/{cep}',
    tags: ['Empresa'],
    summary: 'Consulta uma sugestão de endereço sem salvar dados',
    security: [{ bearerAuth: [] }],
    request: { params: consultarCepSchema },
    responses: {
      200: {
        description: 'Sugestão retornada pela BrasilAPI.',
        content: { 'application/json': { schema: enderecoCepSchema } },
      },
      422: {
        description: 'CEP inválido.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/webhook/whatsapp',
    tags: ['Webhook WhatsApp'],
    summary: 'Confirma a configuração do webhook para a Meta',
    request: { query: challengeWhatsappSchema },
    responses: {
      200: {
        description: 'Challenge devolvido como text/plain.',
        content: { 'text/plain': { schema: z.string() } },
      },
      403: {
        description: 'Token de verificação inválido.',
        content: { 'application/json': { schema: erroSchema } },
      },
      422: {
        description: 'Parâmetros de challenge inválidos.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'post',
    path: '/api/v1/webhook/whatsapp',
    tags: ['Webhook WhatsApp'],
    summary: 'Valida e enfileira mensagens recebidas da Meta',
    request: {
      headers: assinaturaWebhookSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: webhookWhatsappSchema } },
      },
    },
    responses: {
      200: {
        description: 'Evento aceito; duplicidades são reconhecidas sem novo job.',
        content: { 'application/json': { schema: webhookRespostaSchema } },
      },
      403: {
        description: 'Assinatura HMAC inválida ou ausente.',
        content: { 'application/json': { schema: erroSchema } },
      },
      404: {
        description: 'phone_number_id não vinculado a um tenant ativo.',
        content: { 'application/json': { schema: erroSchema } },
      },
      422: {
        description: 'Payload fora do formato suportado.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'post',
    path: '/api/v1/auth/login',
    tags: ['Autenticação'],
    summary: 'Autentica um usuário e resolve seu tenant',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: loginSchema } },
      },
    },
    responses: {
      200: {
        description: 'Sessão criada; o refresh token é enviado em cookie HttpOnly.',
        content: { 'application/json': { schema: loginRespostaSchema } },
      },
      401: {
        description: 'Credenciais inválidas ou tenant indisponível.',
        content: { 'application/json': { schema: erroSchema } },
      },
      422: {
        description: 'Dados de entrada inválidos.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'post',
    path: '/api/v1/interno/auth/2fa/configurar',
    tags: ['Admin interno'],
    summary: 'Gera segredo e QR code para a primeira configuração TOTP',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: estadoInternoSchema } },
      },
    },
    responses: {
      200: {
        description: 'Configuração TOTP pendente de confirmação.',
        content: { 'application/json': { schema: configurarTotpRespostaSchema } },
      },
      401: {
        description: 'Estado temporário inválido ou expirado.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'post',
    path: '/api/v1/interno/auth/2fa/verificar',
    tags: ['Admin interno'],
    summary: 'Valida o TOTP e emite a sessão administrativa',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: verificarTotpInternoSchema } },
      },
    },
    responses: {
      200: {
        description: 'Segundo fator confirmado.',
        content: { 'application/json': { schema: sessaoInternaRespostaSchema } },
      },
      401: {
        description: 'Estado ou código TOTP inválido.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'post',
    path: '/api/v1/auth/refresh',
    tags: ['Autenticação'],
    summary: 'Rotaciona o refresh token e emite novo access token',
    responses: {
      200: {
        description: 'Token renovado e cookie rotacionado.',
        content: { 'application/json': { schema: refreshRespostaSchema } },
      },
      401: {
        description: 'Refresh token ausente, inválido, expirado ou revogado.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'post',
    path: '/api/v1/auth/logout',
    tags: ['Autenticação'],
    summary: 'Revoga a sessão e limpa o cookie de refresh',
    responses: {
      204: { description: 'Sessão encerrada.' },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/saude',
    tags: ['Infraestrutura'],
    summary: 'Verifica se o processo HTTP está ativo',
    responses: {
      200: {
        description: 'Processo ativo.',
        content: {
          'application/json': { schema: saudeSchema },
        },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/prontidao',
    tags: ['Infraestrutura'],
    summary: 'Verifica se a API está pronta para receber tráfego',
    responses: {
      200: {
        description: 'Todas as dependências estão disponíveis.',
        content: {
          'application/json': { schema: prontidaoSchema },
        },
      },
      503: {
        description: 'Uma ou mais dependências estão indisponíveis.',
        content: {
          'application/json': { schema: prontidaoSchema },
        },
      },
    },
  });

  registro.registerPath({
    method: 'post',
    path: '/api/v1/interno/auth/login',
    tags: ['Admin interno'],
    summary: 'Inicia a autenticação de um super administrador',
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: loginInternoSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'Credenciais válidas ou segundo fator necessário.',
        content: {
          'application/json': { schema: loginInternoRespostaSchema },
        },
      },
      401: {
        description: 'Credenciais inválidas.',
        content: {
          'application/json': { schema: erroSchema },
        },
      },
      422: {
        description: 'Dados de entrada inválidos.',
        content: {
          'application/json': { schema: erroSchema },
        },
      },
      429: {
        description: 'Limite de tentativas excedido.',
        content: {
          'application/json': { schema: erroSchema },
        },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/interno/saude',
    tags: ['Admin interno'],
    summary: 'Valida uma sessão administrativa interna',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Sessão interna válida.',
        content: { 'application/json': { schema: saudeInternaSchema } },
      },
      401: {
        description: 'Token ausente, inválido ou expirado.',
        content: {
          'application/json': { schema: erroSchema },
        },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/interno/tenants',
    tags: ['Admin interno - Tenants'],
    summary: 'Lista tenants com paginação, busca, filtros e ordenação',
    security: [{ bearerAuth: [] }],
    request: { query: listarTenantsSchema },
    responses: {
      200: {
        description: 'Página de tenants.',
        content: { 'application/json': { schema: paginaTenantsInternosSchema } },
      },
      401: {
        description: 'Sessão interna ausente ou inválida.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'post',
    path: '/api/v1/interno/tenants',
    tags: ['Admin interno - Tenants'],
    summary: 'Provisiona um tenant manual de forma idempotente',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: provisionarTenantSchema } },
      },
    },
    responses: {
      202: {
        description: 'Provisionamento concluído ou retomado.',
        content: { 'application/json': { schema: tenantInternoSchema } },
      },
      401: {
        description: 'Sessão interna ausente ou inválida.',
        content: { 'application/json': { schema: erroSchema } },
      },
      422: {
        description: 'Entrada ou regra de negócio inválida.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/interno/tenants/{tenantId}',
    tags: ['Admin interno - Tenants'],
    summary: 'Detalha um tenant por identificador público',
    security: [{ bearerAuth: [] }],
    request: { params: tenantPublicIdSchema },
    responses: {
      200: {
        description: 'Detalhe, usuários e histórico de assinaturas.',
        content: { 'application/json': { schema: tenantDetalheInternoSchema } },
      },
      404: {
        description: 'Tenant não encontrado.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'patch',
    path: '/api/v1/interno/tenants/{tenantId}/status',
    tags: ['Admin interno - Tenants'],
    summary: 'Altera o status e registra auditoria',
    security: [{ bearerAuth: [] }],
    request: {
      params: tenantPublicIdSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: alterarStatusTenantSchema } },
      },
    },
    responses: {
      200: {
        description: 'Status alterado.',
        content: { 'application/json': { schema: tenantInternoSchema } },
      },
      422: {
        description: 'Confirmação ausente ou transição inválida.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'patch',
    path: '/api/v1/interno/tenants/{tenantId}/plano',
    tags: ['Admin interno - Tenants'],
    summary: 'Altera o plano manual e registra auditoria',
    security: [{ bearerAuth: [] }],
    request: {
      params: tenantPublicIdSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: alterarPlanoTenantSchema } },
      },
    },
    responses: {
      200: {
        description: 'Assinatura manual criada.',
        content: { 'application/json': { schema: assinaturaInternaSchema } },
      },
      422: {
        description: 'Confirmação ausente ou regra inválida.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'post',
    path: '/api/v1/interno/tenants/{tenantId}/impersonar',
    tags: ['Admin interno - Tenants'],
    summary: 'Emite acesso temporário e auditado ao painel do tenant',
    description:
      'Seleciona o primeiro administrador ativo do tenant. Não cria refresh token e limpa eventual cookie de sessão tenant anterior.',
    security: [{ bearerAuth: [] }],
    request: { params: tenantPublicIdSchema },
    responses: {
      200: {
        description: 'Sessão impersonada temporária. O frontend não deve tentar renová-la.',
        content: { 'application/json': { schema: impersonacaoTenantRespostaSchema } },
      },
      403: {
        description: 'Operador interno não está mais ativo.',
        content: { 'application/json': { schema: erroSchema } },
      },
      404: {
        description: 'Tenant ativo ou administrador ativo não encontrado.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'delete',
    path: '/api/v1/interno/tenants/{tenantId}',
    tags: ['Admin interno - Tenants'],
    summary: 'Exclui definitivamente o tenant e seu banco físico',
    description:
      'Operação irreversível. Exige reautenticação do super administrador e tenant previamente suspenso ou cancelado.',
    security: [{ bearerAuth: [] }],
    request: {
      params: tenantPublicIdSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: excluirTenantDefinitivamenteSchema } },
      },
    },
    responses: {
      204: { description: 'Banco físico e registros centrais removidos definitivamente.' },
      401: {
        description: 'Sessão interna ou senha de reautenticação inválida.',
        content: { 'application/json': { schema: erroSchema } },
      },
      404: {
        description: 'Tenant não encontrado.',
        content: { 'application/json': { schema: erroSchema } },
      },
      409: {
        description: 'Tenant não está suspenso/cancelado ou não possui banco registrado.',
        content: { 'application/json': { schema: erroSchema } },
      },
      422: {
        description: 'Confirmação inválida ou nome do tenant divergente.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/fluxos',
    tags: ['Fluxos'],
    summary: 'Lista rascunhos e fluxos publicados do tenant',
    security: [{ bearerAuth: [] }],
    request: { query: listarFluxosSchema },
    responses: {
      200: {
        description: 'Página ordenada pela atualização mais recente.',
        content: { 'application/json': { schema: paginaFluxosSchema } },
      },
      401: {
        description: 'Access token ausente ou inválido.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'post',
    path: '/api/v1/fluxos',
    tags: ['Fluxos'],
    summary: 'Cria um fluxo como rascunho',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: criarFluxoSchema } },
      },
    },
    responses: {
      201: {
        description: 'Rascunho criado com `public_id` para navegação e edição.',
        content: { 'application/json': { schema: fluxoDetalheSchema.omit({ versoes: true }) } },
      },
      422: {
        description: 'Contrato estrutural inválido.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/fluxos/{fluxoId}',
    tags: ['Fluxos'],
    summary: 'Detalha o rascunho e a última versão publicada',
    security: [{ bearerAuth: [] }],
    request: { params: fluxoPublicIdSchema },
    responses: {
      200: {
        description: 'Fluxo encontrado.',
        content: { 'application/json': { schema: fluxoDetalheSchema } },
      },
      404: {
        description: 'Fluxo inexistente ou excluído.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'put',
    path: '/api/v1/fluxos/{fluxoId}',
    tags: ['Fluxos'],
    summary: 'Atualiza somente o rascunho editável',
    security: [{ bearerAuth: [] }],
    request: {
      params: fluxoPublicIdSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: atualizarFluxoSchema } },
      },
    },
    responses: {
      200: {
        description: 'Rascunho atualizado sem alterar versões publicadas.',
        content: { 'application/json': { schema: fluxoDetalheSchema } },
      },
      404: {
        description: 'Fluxo inexistente ou excluído.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'delete',
    path: '/api/v1/fluxos/{fluxoId}',
    tags: ['Fluxos'],
    summary: 'Exclui logicamente um fluxo',
    security: [{ bearerAuth: [] }],
    request: { params: fluxoPublicIdSchema },
    responses: {
      204: { description: 'Fluxo ocultado por soft delete.' },
      404: {
        description: 'Fluxo inexistente ou já excluído.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'post',
    path: '/api/v1/fluxos/{fluxoId}/publicar',
    tags: ['Fluxos'],
    summary: 'Valida o grafo e cria uma versão publicada imutável',
    security: [{ bearerAuth: [] }],
    request: { params: fluxoPublicIdSchema },
    responses: {
      201: {
        description: 'Nova versão publicada.',
        content: { 'application/json': { schema: versaoFluxoSchema } },
      },
      409: {
        description: 'Não existem alterações pendentes.',
        content: { 'application/json': { schema: erroSchema } },
      },
      422: {
        description: 'Grafo inválido; detalhes contêm erros por nó e campo.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'post',
    path: '/api/v1/fluxos/{fluxoId}/simular',
    tags: ['Fluxos'],
    summary: 'Executa a versão publicada sem enviar mensagens reais',
    security: [{ bearerAuth: [] }],
    request: {
      params: fluxoPublicIdSchema,
      body: {
        required: true,
        content: { 'application/json': { schema: simularFluxoSchema } },
      },
    },
    responses: {
      200: {
        description: 'Estado e saídas determinísticas da simulação.',
        content: { 'application/json': { schema: simulacaoFluxoRespostaSchema } },
      },
      404: {
        description: 'Versão publicada não encontrada.',
        content: { 'application/json': { schema: erroSchema } },
      },
      422: {
        description: 'Estado incompatível ou limite de execução atingido.',
        content: { 'application/json': { schema: erroSchema } },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/openapi.json',
    tags: ['Documentação'],
    summary: 'Retorna o contrato OpenAPI em JSON',
    responses: {
      200: {
        description: 'Documento OpenAPI atual.',
        content: { 'application/json': { schema: documentoOpenApiSchema } },
      },
      401: {
        description: 'Autenticação Basic necessária em produção.',
        content: {
          'application/json': { schema: erroSchema },
        },
      },
    },
  });

  registro.registerPath({
    method: 'get',
    path: '/api/v1/docs',
    tags: ['Documentação'],
    summary: 'Exibe a interface Swagger UI',
    responses: {
      200: {
        description: 'Interface HTML da documentação.',
        content: { 'text/html': { schema: z.string() } },
      },
      401: {
        description: 'Autenticação Basic necessária em produção.',
        content: {
          'application/json': { schema: erroSchema },
        },
      },
    },
  });

  return registro;
}

export function gerarDocumentoOpenApi(): ReturnType<OpenApiGeneratorV3['generateDocument']> {
  const gerador = new OpenApiGeneratorV3(criarRegistro().definitions);

  return gerador.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'ZapBot Backend API',
      version: '0.1.0',
      description: 'API da plataforma multi-tenant de automação de atendimento no WhatsApp.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Ambiente local',
      },
    ],
  });
}

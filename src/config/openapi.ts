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
const fluxoResumoSchema = z.object({
  public_id: z.uuid(),
  nome: z.string(),
  versao: z.number().int().nonnegative(),
  ativo: z.boolean(),
  possui_alteracoes_nao_publicadas: z.boolean(),
  publicado_at: z.iso.datetime().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
const fluxoDetalheSchema = fluxoResumoSchema.extend({
  definicao: definicaoFluxoSchema,
  versoes: z.array(
    z.object({
      public_id: z.uuid(),
      versao: z.number().int().positive(),
      created_at: z.iso.datetime(),
    }),
  ),
});
const paginaFluxosSchema = z.object({
  dados: z.array(fluxoResumoSchema),
  total: z.number().int().nonnegative(),
  skip: z.number().int().nonnegative(),
  take: z.number().int().positive(),
});
const versaoFluxoSchema = z.object({
  public_id: z.uuid(),
  versao: z.number().int().positive(),
  definicao: definicaoFluxoSchema,
  created_at: z.iso.datetime(),
});
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
        content: { 'application/json': { schema: paginacaoSchema } },
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
      202: { description: 'Provisionamento concluído ou retomado.' },
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
      200: { description: 'Detalhe, usuários e histórico de assinaturas.' },
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
      200: { description: 'Status alterado.' },
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
      200: { description: 'Assinatura manual criada.' },
      422: {
        description: 'Confirmação ausente ou regra inválida.',
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
      201: { description: 'Rascunho criado.' },
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

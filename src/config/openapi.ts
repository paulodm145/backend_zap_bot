import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

import { loginInternoSchema } from '../dtos/login-interno.dto.js';
import { loginSchema } from '../dtos/login.dto.js';
import { estadoInternoSchema, verificarTotpInternoSchema } from '../dtos/totp-interno.dto.js';
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
    exigeSegundoFator: z.literal(true),
    exigeConfiguracao: z.boolean(),
    estadoToken: z.string(),
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

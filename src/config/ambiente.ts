import 'dotenv/config';
import { z } from 'zod';

const ambienteSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORTA: z.coerce.number().int().positive().max(65_535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    ORIGENS_PERMITIDAS: z
      .string()
      .default('http://localhost:3001')
      .transform((valor) =>
        valor
          .split(',')
          .map((origem) => origem.trim())
          .filter(Boolean),
      ),
    CENTRAL_DATABASE_URL: z.url().startsWith('postgresql://'),
    JWT_TENANT_SECRET: z.string().min(32),
    JWT_TENANT_EXPIRACAO_SEGUNDOS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_EXPIRACAO_DIAS: z.coerce.number().int().positive().max(90).default(30),
    TENANT_CONEXAO_CRIPTOGRAFIA_CHAVE: z.string().regex(/^[a-fA-F0-9]{64}$/),
    TENANT_CLIENTES_CACHE_MAXIMO: z.coerce.number().int().positive().max(100).default(20),
    POSTGRES_ADMIN_URL: z.url().startsWith('postgresql://').optional(),
    REDIS_URL: z.url().refine((valor) => /^rediss?:\/\//.test(valor), {
      message: 'Deve usar o protocolo redis:// ou rediss://',
    }),
    WEBHOOK_WHATSAPP_APP_SECRET: z.string().min(32),
    WEBHOOK_WHATSAPP_VERIFY_TOKEN: z.string().min(16),
    WEBHOOK_IDEMPOTENCIA_SEGUNDOS: z.coerce
      .number()
      .int()
      .positive()
      .default(7 * 24 * 60 * 60),
    JWT_INTERNO_SECRET: z.string().min(32),
    JWT_INTERNO_EXPIRACAO_SEGUNDOS: z.coerce.number().int().positive().default(900),
    TOTP_CRIPTOGRAFIA_CHAVE: z.string().regex(/^[a-fA-F0-9]{64}$/),
    TOTP_INTERNO_OBRIGATORIO: z
      .enum(['true', 'false'])
      .default('true')
      .transform((valor) => valor === 'true'),
    HTTP_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    HTTP_HEADERS_TIMEOUT_MS: z.coerce.number().int().positive().default(31_000),
    HTTP_KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
    HTTP_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    SWAGGER_USUARIO: z.string().min(1).optional(),
    SWAGGER_SENHA: z.string().min(12).optional(),
  })
  .superRefine((valor, contexto) => {
    if (valor.NODE_ENV !== 'production') {
      return;
    }

    if (!valor.SWAGGER_USUARIO) {
      contexto.addIssue({
        code: 'custom',
        path: ['SWAGGER_USUARIO'],
        message: 'Obrigatório em produção',
      });
    }

    if (!valor.SWAGGER_SENHA) {
      contexto.addIssue({
        code: 'custom',
        path: ['SWAGGER_SENHA'],
        message: 'Obrigatório em produção',
      });
    }

    if (!valor.TOTP_INTERNO_OBRIGATORIO) {
      contexto.addIssue({
        code: 'custom',
        path: ['TOTP_INTERNO_OBRIGATORIO'],
        message: 'Deve permanecer habilitado em produção',
      });
    }
  });

const resultado = ambienteSchema.safeParse(process.env);

if (!resultado.success) {
  const detalhes = resultado.error.issues
    .map((erro) => `${erro.path.join('.')}: ${erro.message}`)
    .join('; ');

  throw new Error(`Variáveis de ambiente inválidas: ${detalhes}`);
}

export const ambiente = resultado.data;

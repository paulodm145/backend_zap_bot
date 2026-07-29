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
    JWT_INTERNO_SECRET: z.string().min(32),
    JWT_INTERNO_EXPIRACAO_SEGUNDOS: z.coerce.number().int().positive().default(900),
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
  });

const resultado = ambienteSchema.safeParse(process.env);

if (!resultado.success) {
  const detalhes = resultado.error.issues
    .map((erro) => `${erro.path.join('.')}: ${erro.message}`)
    .join('; ');

  throw new Error(`Variáveis de ambiente inválidas: ${detalhes}`);
}

export const ambiente = resultado.data;

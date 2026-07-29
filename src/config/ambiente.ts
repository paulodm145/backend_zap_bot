import 'dotenv/config';
import { z } from 'zod';

const ambienteSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORTA: z.coerce.number().int().positive().max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
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
});

const resultado = ambienteSchema.safeParse(process.env);

if (!resultado.success) {
  const detalhes = resultado.error.issues
    .map((erro) => `${erro.path.join('.')}: ${erro.message}`)
    .join('; ');

  throw new Error(`Variáveis de ambiente inválidas: ${detalhes}`);
}

export const ambiente = resultado.data;

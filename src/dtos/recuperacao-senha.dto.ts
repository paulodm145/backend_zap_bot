import { z } from 'zod';

export const esqueciSenhaSchema = z.object({
  email: z.email().max(254),
});

export const redefinirSenhaSchema = z.object({
  token: z.string().min(32).max(200),
  novaSenha: z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
});

export type EsqueciSenhaEntrada = z.infer<typeof esqueciSenhaSchema>;
export type RedefinirSenhaEntrada = z.infer<typeof redefinirSenhaSchema>;

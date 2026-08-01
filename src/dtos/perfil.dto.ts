import { z } from '../config/zod-openapi.js';

const novaSenhaSchema = z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/);

export const atualizarPerfilSchema = z.object({ nome: z.string().trim().min(2).max(150) }).strict();
export const alterarSenhaPerfilSchema = z
  .object({ senhaAtual: z.string().min(1).max(200), novaSenha: novaSenhaSchema })
  .strict();
export const alterarEmailPerfilSchema = z
  .object({
    senhaAtual: z.string().min(1).max(200),
    novoEmail: z.string().trim().pipe(z.email().max(254)),
  })
  .strict();

export type AtualizarPerfilEntrada = z.infer<typeof atualizarPerfilSchema>;
export type AlterarSenhaPerfilEntrada = z.infer<typeof alterarSenhaPerfilSchema>;
export type AlterarEmailPerfilEntrada = z.infer<typeof alterarEmailPerfilSchema>;

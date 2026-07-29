import { z } from 'zod';

export const loginInternoSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email())
    .transform((email) => email.toLowerCase()),
  senha: z.string().min(8).max(128),
});

export type LoginInternoDTO = z.infer<typeof loginInternoSchema>;

import { z } from 'zod';

import { normalizarEmail } from '../helpers/email.helper.js';

export const loginInternoSchema = z.object({
  email: z.string().trim().pipe(z.email()).transform(normalizarEmail),
  senha: z.string().min(8).max(128),
});

export type LoginInternoDTO = z.infer<typeof loginInternoSchema>;

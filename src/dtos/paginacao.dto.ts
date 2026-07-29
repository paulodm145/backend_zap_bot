import { z } from '../config/zod-openapi.js';

export const paginacaoSchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(100).default(20),
  busca: z.string().trim().min(1).max(150).optional(),
});

export type PaginacaoEntrada = z.infer<typeof paginacaoSchema>;

export interface PaginacaoResultado<T> {
  dados: T[];
  total: number;
  skip: number;
  take: number;
}

export function criarPaginacaoResultado<T>(
  dados: T[],
  total: number,
  entrada: Pick<PaginacaoEntrada, 'skip' | 'take'>,
): PaginacaoResultado<T> {
  return { dados, total, skip: entrada.skip, take: entrada.take };
}

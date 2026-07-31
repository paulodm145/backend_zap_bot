import { z } from 'zod';

export const estadoBrasilApiSchema = z
  .object({
    id: z.number().int().positive(),
    sigla: z.string().regex(/^[A-Z]{2}$/),
    nome: z.string().trim().min(1).max(80),
    regiao: z
      .object({
        nome: z.string().trim().min(1).max(30),
      })
      .loose(),
  })
  .loose();

export const estadosBrasilApiSchema = z.array(estadoBrasilApiSchema).length(27);

export const municipioBrasilApiSchema = z
  .object({
    nome: z.string().trim().min(1).max(150),
    codigo_ibge: z.coerce.string().regex(/^\d{7,12}$/),
  })
  .loose();

export const municipiosBrasilApiSchema = z.array(municipioBrasilApiSchema).min(1);

export const cepBrasilApiSchema = z
  .object({
    cep: z.string(),
    state: z.string().regex(/^[A-Z]{2}$/),
    city: z.string().trim().min(1),
    neighborhood: z.string().nullable().optional(),
    street: z.string().nullable().optional(),
    city_ibge: z.coerce
      .string()
      .regex(/^\d{7,12}$/)
      .nullable()
      .optional(),
  })
  .loose();

export type EstadoBrasilApi = z.infer<typeof estadoBrasilApiSchema>;
export type MunicipioBrasilApi = z.infer<typeof municipioBrasilApiSchema>;
export type CepBrasilApi = z.infer<typeof cepBrasilApiSchema>;

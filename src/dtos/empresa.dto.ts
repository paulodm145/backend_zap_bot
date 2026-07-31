import { z } from '../config/zod-openapi.js';
import { normalizarCep, normalizarCnpj } from '../helpers/documento.helper.js';
import { normalizarEmail } from '../helpers/email.helper.js';
import { normalizarTelefone } from '../helpers/telefone.helper.js';

const textoOpcional = (maximo: number) =>
  z.string().trim().min(1).max(maximo).nullable().optional();

const cnpjSchema = z
  .string()
  .transform(normalizarCnpj)
  .pipe(z.string().length(14, 'CNPJ inválido'))
  .nullable()
  .optional();
const cepSchema = z
  .string()
  .transform(normalizarCep)
  .pipe(z.string().length(8, 'CEP inválido'))
  .nullable()
  .optional();
const telefoneSchema = z
  .string()
  .transform(normalizarTelefone)
  .pipe(z.string().min(1, 'Telefone inválido'))
  .nullable()
  .optional();

export const atualizarEmpresaSchema = z
  .object({
    razaoSocial: textoOpcional(180),
    nomeFantasia: textoOpcional(180),
    cnpj: cnpjSchema,
    email: z
      .string()
      .trim()
      .pipe(z.email().max(254))
      .transform(normalizarEmail)
      .nullable()
      .optional(),
    telefone: telefoneSchema,
    site: z.url().max(255).nullable().optional(),
    cep: cepSchema,
    logradouro: textoOpcional(180),
    numero: textoOpcional(30),
    complemento: textoOpcional(120),
    bairro: textoOpcional(120),
    municipioCodigoIbge: z
      .string()
      .regex(/^\d{7,12}$/)
      .nullable()
      .optional(),
    municipioNome: textoOpcional(150),
    uf: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/)
      .nullable()
      .optional(),
  })
  .strict()
  .refine((valor) => Object.keys(valor).length > 0, 'Informe ao menos um campo')
  .openapi('AtualizarEmpresaEntrada');

export const consultarCepSchema = z
  .object({
    cep: z.string().transform(normalizarCep).pipe(z.string().length(8, 'CEP inválido')),
  })
  .strict()
  .openapi('ConsultarCepParametro');

export type AtualizarEmpresaEntrada = z.infer<typeof atualizarEmpresaSchema>;

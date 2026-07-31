import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';

import { PrismaClient } from '../src/generated/prisma/client.js';
import { lerArgumentosNomeados } from '../src/helpers/argumentos-cli.helper.js';
import { CatalogoGeograficoRepository } from '../src/repositories/catalogo-geografico.repository.js';
import { BrasilApiService } from '../src/services/brasil-api.service.js';

const ambienteSchema = z.object({
  CENTRAL_DATABASE_URL: z.url().startsWith('postgresql://'),
  BRASIL_API_URL: z.url().default('https://brasilapi.com.br/api'),
  BRASIL_API_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  BRASIL_API_TENTATIVAS: z.coerce.number().int().min(1).max(5).default(3),
});

async function executar(): Promise<void> {
  const ambiente = ambienteSchema.parse(process.env);
  const argumentos = lerArgumentosNomeados(process.argv.slice(2));
  const ufInformada = argumentos.uf?.trim().toUpperCase();
  if (ufInformada && !/^[A-Z]{2}$/.test(ufInformada)) {
    throw new Error('O argumento --uf deve conter uma sigla com duas letras');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(ambiente.CENTRAL_DATABASE_URL) });
  const brasilApi = new BrasilApiService(
    ambiente.BRASIL_API_URL,
    ambiente.BRASIL_API_TIMEOUT_MS,
    ambiente.BRASIL_API_TENTATIVAS,
  );
  const repository = new CatalogoGeograficoRepository(prisma);
  let estadosCriados = 0;
  let estadosAtualizados = 0;
  let estadosInalterados = 0;
  let municipiosCriados = 0;
  let municipiosAtualizados = 0;
  let municipiosInalterados = 0;
  let municipiosDesativados = 0;
  const falhas: { uf: string; erro: string }[] = [];

  try {
    const estados = await brasilApi.listarEstados();
    const selecionados = ufInformada
      ? estados.filter((estado) => estado.sigla === ufInformada)
      : estados;
    if (selecionados.length === 0) throw new Error(`UF não encontrada: ${ufInformada ?? ''}`);

    for (const estado of selecionados) {
      try {
        const resumo = await repository.importarEstado(
          estado,
          await brasilApi.listarMunicipios(estado.sigla),
        );
        estadosCriados += resumo.estadosCriados;
        estadosAtualizados += resumo.estadosAtualizados;
        estadosInalterados += resumo.estadosInalterados;
        municipiosCriados += resumo.municipiosCriados;
        municipiosAtualizados += resumo.municipiosAtualizados;
        municipiosInalterados += resumo.municipiosInalterados;
        municipiosDesativados += resumo.municipiosDesativados;
      } catch (erro: unknown) {
        falhas.push({ uf: estado.sigla, erro: String(erro) });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  process.stdout.write(
    `${JSON.stringify({ estadosCriados, estadosAtualizados, estadosInalterados, municipiosCriados, municipiosAtualizados, municipiosInalterados, municipiosDesativados, falhas }, null, 2)}\n`,
  );
  if (falhas.length > 0) process.exitCode = 1;
}

executar().catch((erro: unknown) => {
  process.stderr.write(`Falha ao importar catálogo geográfico: ${String(erro)}\n`);
  process.exitCode = 1;
});

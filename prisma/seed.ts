import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';

const url = process.env.CENTRAL_DATABASE_URL;

if (!url) {
  throw new Error('CENTRAL_DATABASE_URL é obrigatória para executar o seed');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(url),
});

const planos = [
  {
    nome: 'Free',
    limite_conversas_mes: 200,
    preco_centavos: 0,
  },
  {
    nome: 'Starter',
    limite_conversas_mes: 2_000,
    preco_centavos: 9_900,
  },
  {
    nome: 'Pro',
    limite_conversas_mes: 10_000,
    preco_centavos: 29_900,
  },
] as const;

async function executar(): Promise<void> {
  for (const plano of planos) {
    await prisma.plano.upsert({
      where: { nome: plano.nome },
      create: plano,
      update: {
        limite_conversas_mes: plano.limite_conversas_mes,
        preco_centavos: plano.preco_centavos,
        ativo: true,
      },
    });
  }
}

executar()
  .catch((erro: unknown) => {
    process.stderr.write(`Falha ao executar seed: ${String(erro)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

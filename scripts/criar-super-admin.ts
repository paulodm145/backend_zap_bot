import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { normalizarEmail } from '../src/helpers/email.helper.js';
import { lerArgumentosNomeados } from '../src/helpers/argumentos-cli.helper.js';
import { PapelUsuario, PrismaClient } from '../src/generated/prisma/client.js';

const entradaSchema = z.object({
  CENTRAL_DATABASE_URL: z.url().startsWith('postgresql://'),
  SUPER_ADMIN_NOME: z.string().trim().min(2).max(150),
  SUPER_ADMIN_EMAIL: z.email().transform(normalizarEmail),
  SUPER_ADMIN_SENHA: z.string().min(12).max(128),
});

async function executar(): Promise<void> {
  const argumentos = lerArgumentosNomeados(process.argv.slice(2));
  const entrada = entradaSchema.parse({
    CENTRAL_DATABASE_URL: process.env.CENTRAL_DATABASE_URL,
    SUPER_ADMIN_NOME: argumentos.nome ?? process.env.SUPER_ADMIN_NOME,
    SUPER_ADMIN_EMAIL: argumentos.email ?? process.env.SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_SENHA: argumentos.senha ?? process.env.SUPER_ADMIN_SENHA,
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(entrada.CENTRAL_DATABASE_URL),
  });

  try {
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email: entrada.SUPER_ADMIN_EMAIL },
      select: { id: true },
    });

    if (usuarioExistente) {
      throw new Error('Já existe um usuário com o e-mail informado');
    }

    await prisma.usuario.create({
      data: {
        nome: entrada.SUPER_ADMIN_NOME,
        email: entrada.SUPER_ADMIN_EMAIL,
        senha_hash: await bcrypt.hash(entrada.SUPER_ADMIN_SENHA, 12),
        papel: PapelUsuario.SUPER_ADMIN,
        ativo: true,
      },
    });

    process.stdout.write('Super administrador criado com sucesso\n');
  } finally {
    await prisma.$disconnect();
  }
}

executar().catch((erro: unknown) => {
  process.stderr.write(`Falha ao criar super administrador: ${String(erro)}\n`);
  process.exitCode = 1;
});

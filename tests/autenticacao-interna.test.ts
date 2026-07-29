import './configurar-ambiente.js';

import { PrismaPg } from '@prisma/adapter-pg';
import { TOTP, Secret } from 'otpauth';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { criarAplicacao } from '../src/app.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { HashSenhaService } from '../src/services/hash-senha.service.js';

const urlTeste = process.env.TEST_DATABASE_URL ?? 'postgresql://invalido';
const descreverIntegracao = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const loginSchema = z.object({
  exigeSegundoFator: z.literal(true),
  exigeConfiguracao: z.boolean(),
  estadoToken: z.string(),
});
const configurarSchema = z.object({ segredo: z.string(), qrCode: z.string() });
const tokenSchema = z.object({ accessToken: z.string() });

descreverIntegracao('autenticação interna com TOTP', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(urlTeste) });
  const aplicacao = criarAplicacao({ prismaCentral: prisma });

  beforeAll(async () => prisma.$connect());
  beforeEach(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: '@interno.test' } } });
  });
  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: '@interno.test' } } });
    await prisma.$disconnect();
  });

  async function criarUsuario(papel: 'SUPER_ADMIN' | 'USUARIO' = 'SUPER_ADMIN', ativo = true) {
    return prisma.usuario.create({
      data: {
        nome: 'Admin Interno',
        email: 'admin@interno.test',
        senha_hash: await new HashSenhaService().gerar('senha-interna-segura'),
        papel,
        ativo,
      },
    });
  }

  it('configura e verifica TOTP antes de emitir a sessão interna', async () => {
    await criarUsuario();
    const login = await request(aplicacao)
      .post('/api/v1/interno/auth/login')
      .send({ email: 'admin@interno.test', senha: 'senha-interna-segura' });
    const estado = loginSchema.parse(login.body as unknown);
    expect(estado.exigeConfiguracao).toBe(true);

    const configurar = await request(aplicacao)
      .post('/api/v1/interno/auth/2fa/configurar')
      .send({ estadoToken: estado.estadoToken });
    const configuracao = configurarSchema.parse(configurar.body as unknown);
    expect(configuracao.qrCode).toMatch(/^data:image\/png;base64,/);

    const codigo = new TOTP({
      issuer: 'ZapBot',
      label: 'admin@interno.test',
      secret: Secret.fromBase32(configuracao.segredo),
    }).generate();
    const verificar = await request(aplicacao)
      .post('/api/v1/interno/auth/2fa/verificar')
      .send({ estadoToken: estado.estadoToken, codigo });
    expect(tokenSchema.parse(verificar.body as unknown).accessToken).not.toHaveLength(0);

    const persistido = await prisma.usuario.findUniqueOrThrow({
      where: { email: 'admin@interno.test' },
    });
    expect(persistido.totp_habilitado).toBe(true);
    expect(persistido.totp_secret_encrypted).not.toContain(configuracao.segredo);
  });

  it('recusa código TOTP inválido', async () => {
    await criarUsuario();
    const login = await request(aplicacao)
      .post('/api/v1/interno/auth/login')
      .send({ email: 'admin@interno.test', senha: 'senha-interna-segura' });
    const estado = loginSchema.parse(login.body as unknown);
    await request(aplicacao)
      .post('/api/v1/interno/auth/2fa/configurar')
      .send({ estadoToken: estado.estadoToken });
    const resposta = await request(aplicacao)
      .post('/api/v1/interno/auth/2fa/verificar')
      .send({ estadoToken: estado.estadoToken, codigo: '000000' });
    expect(resposta.status).toBe(401);
  });

  it.each([
    ['papel incorreto', 'USUARIO', true],
    ['usuário inativo', 'SUPER_ADMIN', false],
  ] as const)('recusa %s', async (_cenario, papel, ativo) => {
    await criarUsuario(papel, ativo);
    const resposta = await request(aplicacao)
      .post('/api/v1/interno/auth/login')
      .send({ email: 'admin@interno.test', senha: 'senha-interna-segura' });
    expect(resposta.status).toBe(403);
  });
});

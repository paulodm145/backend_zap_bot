import './configurar-ambiente.js';

import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { criarAplicacao } from '../src/app.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

const urlTeste = process.env.TEST_DATABASE_URL ?? 'postgresql://invalido';
const descreverIntegracao = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const erroRespostaSchema = z.object({ erro: z.object({ codigo: z.string() }) });
const loginRespostaSchema = z.object({
  accessToken: z.string(),
  usuario: z.object({
    id: z.string(),
    nome: z.string(),
    email: z.string(),
    tenantId: z.string(),
  }),
});
const refreshRespostaSchema = z.object({ accessToken: z.string() });

function primeiroCookie(cabecalho: unknown): string {
  return z.tuple([z.string()]).rest(z.string()).parse(cabecalho)[0];
}

descreverIntegracao('contrato HTTP de autenticação do tenant', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(urlTeste) });
  const aplicacao = criarAplicacao({ prismaCentral: prisma });
  const origem = 'http://localhost:3001';

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.usuario.deleteMany({ where: { email: { endsWith: '@auth.test' } } });
    await prisma.tenant.deleteMany({ where: { nome: { startsWith: 'Tenant Auth' } } });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.usuario.deleteMany({ where: { email: { endsWith: '@auth.test' } } });
    await prisma.tenant.deleteMany({ where: { nome: { startsWith: 'Tenant Auth' } } });
    await prisma.$disconnect();
  });

  async function prepararUsuario(status: 'ATIVO' | 'SUSPENSO' = 'ATIVO') {
    const tenant = await prisma.tenant.create({
      data: { nome: `Tenant Auth ${status}`, status },
    });
    const usuario = await prisma.usuario.create({
      data: {
        tenant_id: tenant.id,
        nome: 'Maria Admin',
        email: 'maria@auth.test',
        senha_hash: await bcrypt.hash('senha-correta', 4),
        papel: 'ADMIN_TENANT',
      },
    });
    return { tenant, usuario };
  }

  it('retorna o contrato exato e cookie seguro no login válido', async () => {
    const { tenant, usuario } = await prepararUsuario();
    const resposta = await request(aplicacao)
      .post('/api/v1/auth/login')
      .set('Origin', origem)
      .send({ email: ' MARIA@AUTH.TEST ', senha: 'senha-correta' });

    expect(resposta.status).toBe(200);
    const corpo = loginRespostaSchema.parse(resposta.body as unknown);
    expect(corpo.accessToken).not.toHaveLength(0);
    expect(corpo.usuario).toEqual({
      id: usuario.public_id,
      nome: usuario.nome,
      email: usuario.email,
      tenantId: tenant.public_id,
    });
    expect(resposta.headers['access-control-allow-origin']).toBe(origem);
    expect(resposta.headers['access-control-allow-credentials']).toBe('true');
    expect(resposta.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(resposta.headers['set-cookie']?.[0]).toContain('Secure');
    expect(resposta.headers['set-cookie']?.[0]).toContain('SameSite=None');
    expect(resposta.headers['set-cookie']?.[0]).toContain('Path=/api/v1/auth');
  });

  it('não revela se a credencial ou o tenant é inválido', async () => {
    await prepararUsuario('SUSPENSO');
    for (const entrada of [
      { email: 'maria@auth.test', senha: 'errada' },
      { email: 'inexistente@auth.test', senha: 'errada' },
      { email: 'maria@auth.test', senha: 'senha-correta' },
    ]) {
      const resposta = await request(aplicacao).post('/api/v1/auth/login').send(entrada);
      expect(resposta.status).toBe(401);
      expect(erroRespostaSchema.parse(resposta.body as unknown).erro.codigo).toBe(
        'CREDENCIAIS_INVALIDAS',
      );
    }
  });

  it('rotaciona refresh token e revoga a família em caso de reutilização', async () => {
    await prepararUsuario();
    const login = await request(aplicacao)
      .post('/api/v1/auth/login')
      .send({ email: 'maria@auth.test', senha: 'senha-correta' });
    const cookieOriginal = primeiroCookie(login.headers['set-cookie']);

    const renovacao = await request(aplicacao)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieOriginal);
    expect(renovacao.status).toBe(200);
    expect(refreshRespostaSchema.parse(renovacao.body as unknown).accessToken).not.toHaveLength(0);
    const cookieNovo = primeiroCookie(renovacao.headers['set-cookie']);
    expect(cookieNovo).not.toBe(cookieOriginal);

    const reutilizacao = await request(aplicacao)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieOriginal);
    expect(reutilizacao.status).toBe(401);
    expect(erroRespostaSchema.parse(reutilizacao.body as unknown).erro.codigo).toBe(
      'REFRESH_TOKEN_INVALIDO',
    );

    const familiaRevogada = await request(aplicacao)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieNovo);
    expect(familiaRevogada.status).toBe(401);
  });

  it('revoga o token e limpa o cookie no logout', async () => {
    await prepararUsuario();
    const login = await request(aplicacao)
      .post('/api/v1/auth/login')
      .send({ email: 'maria@auth.test', senha: 'senha-correta' });
    const cookie = primeiroCookie(login.headers['set-cookie']);

    const logout = await request(aplicacao).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie']?.[0]).toContain('refreshToken=');
    expect(logout.headers['set-cookie']?.[0]).toContain('Expires=Thu, 01 Jan 1970');

    const renovacao = await request(aplicacao).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(renovacao.status).toBe(401);
  });

  it('recusa e registra refresh expirado', async () => {
    await prepararUsuario();
    const login = await request(aplicacao)
      .post('/api/v1/auth/login')
      .send({ email: 'maria@auth.test', senha: 'senha-correta' });
    const cookie = primeiroCookie(login.headers['set-cookie']);
    await prisma.refreshToken.updateMany({
      data: { expira_at: new Date(Date.now() - 1_000) },
    });

    const resposta = await request(aplicacao).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(resposta.status).toBe(401);
    const persistido = await prisma.refreshToken.findFirstOrThrow();
    expect(persistido.motivo_revogacao).toBe('EXPIRADO');
  });

  it('recusa refresh ausente e body inválido', async () => {
    const refresh = await request(aplicacao).post('/api/v1/auth/refresh');
    expect(refresh.status).toBe(401);
    const login = await request(aplicacao).post('/api/v1/auth/login').send({});
    expect(login.status).toBe(422);
  });
});

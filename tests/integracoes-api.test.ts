import './configurar-ambiente.js';

import { PrismaPg } from '@prisma/adapter-pg';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { CredencialIntegracaoController } from '../src/controllers/credencial-integracao.controller.js';
import { PrismaClient } from '../src/generated/prisma-tenant/client.js';
import { tratarErro } from '../src/middlewares/erro.middleware.js';
import { criarRotasCredenciaisIntegracao } from '../src/rotas/credencial-integracao.rotas.js';
import { CriptografiaService } from '../src/services/criptografia.service.js';

const url = process.env.TEST_TENANT_DATABASE_URL_A;
const descreverIntegracao = url ? describe : describe.skip;

const CHAVE = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

descreverIntegracao('API de credenciais de integração', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(url ?? '') });
  const criptografia = new CriptografiaService(CHAVE);

  beforeEach(async () => {
    await prisma.credencialIntegracao.deleteMany();
  });

  afterAll(async () => prisma.$disconnect());

  function app(papel: 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE' = 'ADMIN_TENANT') {
    const aplicacao = express();
    aplicacao.use(express.json());
    aplicacao.use((requisicao, _resposta, proximo) => {
      requisicao.usuarioTenant = {
        id: crypto.randomUUID(),
        email: 'gestor@tenant.com',
        tenantId: crypto.randomUUID(),
        papel,
      };
      requisicao.contextoTenant = { id: 1, publicId: crypto.randomUUID(), prisma };
      proximo();
    });
    aplicacao.use(
      '/integracoes',
      criarRotasCredenciaisIntegracao(new CredencialIntegracaoController(criptografia)),
    );
    aplicacao.use(tratarErro);
    return aplicacao;
  }

  const credencialValida = {
    nome: 'ERP Contábil',
    baseUrl: 'https://api.erp-exemplo.com/v1',
    autenticacao: { tipo: 'BEARER', token: 'token-super-secreto-do-erp' },
  };

  it('executa CRUD sem nunca devolver o segredo', async () => {
    const criada = await request(app()).post('/integracoes').send(credencialValida).expect(201);
    const corpo = criada.body as unknown as Record<string, unknown>;
    expect(corpo).toMatchObject({
      nome: 'ERP Contábil',
      tipo_auth: 'BEARER',
      base_url: 'https://api.erp-exemplo.com/v1',
      ativo: true,
    });
    expect(JSON.stringify(corpo)).not.toContain('token-super-secreto-do-erp');
    expect(corpo).not.toHaveProperty('configuracao_encrypted');

    const publicId = corpo.public_id as string;
    const lista = await request(app()).get('/integracoes?busca=erp&skip=0&take=10').expect(200);
    const listaCorpo = lista.body as unknown as { total: number; dados: unknown[] };
    expect(listaCorpo.total).toBe(1);
    expect(JSON.stringify(listaCorpo)).not.toContain('token-super-secreto-do-erp');

    const detalhe = await request(app()).get(`/integracoes/${publicId}`).expect(200);
    expect(JSON.stringify(detalhe.body)).not.toContain('token-super-secreto-do-erp');

    await request(app())
      .put(`/integracoes/${publicId}`)
      .send({ nome: 'ERP Contábil v2' })
      .expect(200);
    await request(app()).delete(`/integracoes/${publicId}`).expect(204);
    const depois = await prisma.credencialIntegracao.findUniqueOrThrow({
      where: { public_id: publicId },
    });
    expect(depois.ativo).toBe(false);
    expect(depois.nome).toBe('ERP Contábil v2');
  });

  it('persiste a autenticação criptografada e recuperável', async () => {
    const criada = await request(app()).post('/integracoes').send(credencialValida).expect(201);
    const publicId = (criada.body as unknown as { public_id: string }).public_id;
    const registro = await prisma.credencialIntegracao.findUniqueOrThrow({
      where: { public_id: publicId },
    });
    expect(registro.configuracao_encrypted).not.toContain('token-super-secreto-do-erp');
    expect(JSON.parse(criptografia.descriptografar(registro.configuracao_encrypted))).toEqual({
      tipo: 'BEARER',
      token: 'token-super-secreto-do-erp',
    });
  });

  it('preserva o segredo quando a atualização não envia autenticação', async () => {
    const criada = await request(app()).post('/integracoes').send(credencialValida).expect(201);
    const publicId = (criada.body as unknown as { public_id: string }).public_id;
    const antes = await prisma.credencialIntegracao.findUniqueOrThrow({
      where: { public_id: publicId },
    });
    await request(app())
      .put(`/integracoes/${publicId}`)
      .send({ baseUrl: 'https://api.erp-exemplo.com/v2' })
      .expect(200);
    const depois = await prisma.credencialIntegracao.findUniqueOrThrow({
      where: { public_id: publicId },
    });
    expect(depois.configuracao_encrypted).toBe(antes.configuracao_encrypted);
    expect(depois.base_url).toBe('https://api.erp-exemplo.com/v2');
  });

  it('troca o segredo quando a atualização envia autenticação', async () => {
    const criada = await request(app()).post('/integracoes').send(credencialValida).expect(201);
    const publicId = (criada.body as unknown as { public_id: string }).public_id;
    await request(app())
      .put(`/integracoes/${publicId}`)
      .send({ autenticacao: { tipo: 'API_KEY_HEADER', cabecalho: 'X-API-Key', valor: 'nova' } })
      .expect(200);
    const depois = await prisma.credencialIntegracao.findUniqueOrThrow({
      where: { public_id: publicId },
    });
    expect(depois.tipo_auth).toBe('API_KEY_HEADER');
    expect(JSON.parse(criptografia.descriptografar(depois.configuracao_encrypted))).toEqual({
      tipo: 'API_KEY_HEADER',
      cabecalho: 'X-API-Key',
      valor: 'nova',
    });
  });

  it.each([
    ['http://api.erp-exemplo.com', 'protocolo'],
    ['https://localhost/api', 'host local'],
    ['https://169.254.169.254/latest', 'metadata da nuvem'],
    ['https://usuario:senha@api.erp-exemplo.com', 'credencial embutida'],
  ])('recusa baseUrl com %s', async (baseUrl) => {
    await request(app())
      .post('/integracoes')
      .send({ ...credencialValida, baseUrl })
      .expect(422);
  });

  it('recusa autenticação incompleta para o tipo informado', async () => {
    await request(app())
      .post('/integracoes')
      .send({ ...credencialValida, autenticacao: { tipo: 'BEARER' } })
      .expect(422);
  });

  it('recusa nome duplicado', async () => {
    await request(app()).post('/integracoes').send(credencialValida).expect(201);
    await request(app()).post('/integracoes').send(credencialValida).expect(409);
  });

  it('nega acesso a quem não é gestão do tenant', async () => {
    await request(app('ATENDENTE')).get('/integracoes').expect(403);
    await request(app('ATENDENTE')).post('/integracoes').send(credencialValida).expect(403);
  });

  it('responde 404 para credencial inexistente', async () => {
    await request(app()).get(`/integracoes/${crypto.randomUUID()}`).expect(404);
    await request(app()).delete(`/integracoes/${crypto.randomUUID()}`).expect(404);
  });
});

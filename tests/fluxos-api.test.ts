import './configurar-ambiente.js';

import { PrismaPg } from '@prisma/adapter-pg';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { FluxoController } from '../src/controllers/fluxo.controller.js';
import { z } from '../src/config/zod-openapi.js';
import { PrismaClient } from '../src/generated/prisma-tenant/client.js';
import { tratarErro } from '../src/middlewares/erro.middleware.js';
import { criarRotasFluxos } from '../src/rotas/fluxo.rotas.js';

const urlTeste = process.env.TEST_TENANT_DATABASE_URL_B;
const descreverIntegracao = urlTeste ? describe : describe.skip;
const prisma = new PrismaClient({
  adapter: new PrismaPg(urlTeste ?? 'postgresql://configuracao:ausente'),
});
const tenantPublicId = '22222222-2222-4222-8222-222222222222';
const fluxoCriadoSchema = z.object({ public_id: z.uuid() });
const fluxoAtualizadoSchema = z.object({ nome: z.string() });
const fluxoPublicadoSchema = z.object({ versao: z.number().int() });
const definicao = {
  schemaVersao: 1,
  noInicial: 'inicio',
  nos: [{ id: 'inicio', tipo: 'mensagem', dados: { texto: 'Olá pelo fluxo' } }],
};

const injetarTenant: RequestHandler = (requisicao, _resposta, proximo) => {
  requisicao.contextoTenant = {
    id: 2,
    publicId: tenantPublicId,
    prisma,
  };
  proximo();
};

const aplicacao = express();
aplicacao.use(express.json());
aplicacao.use(injetarTenant);
aplicacao.use('/api/v1/fluxos', criarRotasFluxos(new FluxoController()));
aplicacao.use(tratarErro);

descreverIntegracao('API de fluxos', () => {
  beforeEach(async () => {
    await prisma.fluxoVersao.deleteMany();
    await prisma.fluxo.deleteMany();
  });

  afterAll(async () => prisma.$disconnect());

  it('executa o ciclo de rascunho, publicação, simulação e exclusão', async () => {
    const criacao = await request(aplicacao)
      .post('/api/v1/fluxos')
      .send({ nome: 'Boas-vindas', definicao });
    expect(criacao.status, JSON.stringify(criacao.body as unknown)).toBe(201);
    const fluxoId = fluxoCriadoSchema.parse(criacao.body as unknown).public_id;

    const listagem = await request(aplicacao)
      .get('/api/v1/fluxos')
      .query({ busca: 'boas', skip: 0, take: 10 });
    expect(listagem.status).toBe(200);
    expect(listagem.body).toMatchObject({ total: 1, skip: 0, take: 10 });

    const atualizacao = await request(aplicacao)
      .put(`/api/v1/fluxos/${fluxoId}`)
      .send({ nome: 'Boas-vindas atualizadas', definicao });
    expect(atualizacao.status).toBe(200);
    expect(fluxoAtualizadoSchema.parse(atualizacao.body as unknown).nome).toBe(
      'Boas-vindas atualizadas',
    );

    const publicacao = await request(aplicacao).post(`/api/v1/fluxos/${fluxoId}/publicar`);
    expect(publicacao.status, JSON.stringify(publicacao.body as unknown)).toBe(201);
    expect(fluxoPublicadoSchema.parse(publicacao.body as unknown).versao).toBe(1);

    const simulacao = await request(aplicacao).post(`/api/v1/fluxos/${fluxoId}/simular`).send({});
    expect(simulacao.status, JSON.stringify(simulacao.body as unknown)).toBe(200);
    expect(simulacao.body).toMatchObject({
      estado: { concluido: true },
      saidas: [{ tipo: 'mensagem', texto: 'Olá pelo fluxo' }],
    });

    const detalhe = await request(aplicacao).get(`/api/v1/fluxos/${fluxoId}`);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body).toMatchObject({ public_id: fluxoId, versao: 1, ativo: true });

    expect((await request(aplicacao).delete(`/api/v1/fluxos/${fluxoId}`)).status).toBe(204);
    expect((await request(aplicacao).get(`/api/v1/fluxos/${fluxoId}`)).status).toBe(404);
  });
});

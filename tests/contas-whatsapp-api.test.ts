import './configurar-ambiente.js';

import { PrismaPg } from '@prisma/adapter-pg';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContaWhatsappController } from '../src/controllers/conta-whatsapp.controller.js';
import { PrismaClient as PrismaCentral } from '../src/generated/prisma/client.js';
import { PrismaClient as PrismaTenant } from '../src/generated/prisma-tenant/client.js';
import { tratarErro } from '../src/middlewares/erro.middleware.js';
import { RoteamentoWhatsappRepository } from '../src/repositories/roteamento-whatsapp.repository.js';
import { criarRotasContasWhatsapp } from '../src/rotas/conta-whatsapp.rotas.js';
import { CriptografiaService } from '../src/services/criptografia.service.js';
import { WhatsappGraphApiService } from '../src/services/whatsapp-graph-api.service.js';

const urlCentral = process.env.TEST_DATABASE_URL;
const urlTenant = process.env.TEST_TENANT_DATABASE_URL_A;
const descreverIntegracao = urlCentral && urlTenant ? describe : describe.skip;

descreverIntegracao('API de contas WhatsApp', () => {
  const central = new PrismaCentral({ adapter: new PrismaPg(urlCentral ?? '') });
  const tenant = new PrismaTenant({ adapter: new PrismaPg(urlTenant ?? '') });
  let tenantId = 0;
  const usuarioId = '40ca22c9-5435-4bb7-81a2-27ee3dfb6277';
  const executarFetch = vi.fn<typeof fetch>().mockImplementation((entrada) => {
    const url =
      typeof entrada === 'string'
        ? entrada
        : entrada instanceof URL
          ? entrada.toString()
          : entrada.url;
    const id = /\/v\d+\.\d+\/(\d+)/.exec(url)?.[1] ?? '';
    return Promise.resolve(
      new Response(JSON.stringify({ id, display_phone_number: '+55 11 99999-9999' }), {
        status: 200,
      }),
    );
  });

  beforeEach(async () => {
    await tenant.auditoriaWhatsapp.deleteMany();
    await tenant.conversa.deleteMany();
    await tenant.contaWhatsapp.deleteMany();
    await central.roteamentoWhatsapp.deleteMany();
    await central.assinatura.deleteMany();
    await central.usuario.deleteMany();
    await central.tenant.deleteMany();
    await central.plano.deleteMany();
    const plano = await central.plano.create({
      data: {
        nome: 'Plano teste WhatsApp',
        limite_conversas_mes: 100,
        limite_contas_whatsapp: 2,
        preco_centavos: 0,
      },
    });
    const registroTenant = await central.tenant.create({
      data: { nome: 'Tenant WhatsApp', status: 'ATIVO' },
    });
    tenantId = registroTenant.id;
    await central.assinatura.create({
      data: { tenant_id: tenantId, plano_id: plano.id, status: 'ATIVA' },
    });
  });

  afterAll(async () => {
    await tenant.$disconnect();
    await central.$disconnect();
  });

  function app() {
    const aplicacao = express();
    aplicacao.use(express.json());
    aplicacao.use((requisicao, _resposta, proximo) => {
      requisicao.usuarioTenant = {
        id: usuarioId,
        email: 'admin@tenant.com',
        tenantId: 'b729496b-7a96-4296-922a-9cf6c55e55df',
        papel: 'ADMIN_TENANT',
      };
      requisicao.contextoTenant = {
        id: tenantId,
        publicId: 'b729496b-7a96-4296-922a-9cf6c55e55df',
        prisma: tenant,
      };
      proximo();
    });
    aplicacao.use(
      '/contas',
      criarRotasContasWhatsapp(
        new ContaWhatsappController(
          new RoteamentoWhatsappRepository(central),
          new CriptografiaService(
            '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          ),
          new WhatsappGraphApiService('https://graph.test', executarFetch),
        ),
      ),
    );
    aplicacao.use(tratarErro);
    return aplicacao;
  }

  it('executa onboarding, edição, rotação, teste e desativação sem expor segredo', async () => {
    const criado = await request(app())
      .post('/contas')
      .send({
        nome: 'Principal',
        phoneNumberId: '123456789',
        wabaId: '987654321',
        versaoGraphApi: 'v23.0',
        accessToken: 'token-de-teste-com-tamanho-suficiente',
      })
      .expect(201);
    const contaId = (criado.body as unknown as { public_id: string }).public_id;
    expect(criado.body).not.toHaveProperty('token_encrypted');
    expect(
      await central.roteamentoWhatsapp.findUnique({ where: { phone_number_id: '123456789' } }),
    ).toMatchObject({ tenant_id: tenantId });

    const lista = await request(app()).get('/contas?skip=0&take=20&busca=Princ').expect(200);
    expect((lista.body as unknown as { total: number }).total).toBe(1);
    await request(app()).get(`/contas/${contaId}`).expect(200);
    await request(app()).put(`/contas/${contaId}`).send({ nome: 'Principal editada' }).expect(200);
    const rotacao = await request(app())
      .patch(`/contas/${contaId}/token`)
      .send({ accessToken: 'segundo-token-com-tamanho-suficiente' })
      .expect(200);
    expect(JSON.stringify(rotacao.body)).not.toContain('segundo-token');
    const teste = await request(app()).post(`/contas/${contaId}/testar`).expect(200);
    expect(teste.body).toMatchObject({ status: 'VALIDADA', numero_exibicao: '+55 11 99999-9999' });
    await request(app()).patch(`/contas/${contaId}/status`).send({ ativo: false }).expect(200);
    expect(await central.roteamentoWhatsapp.count()).toBe(0);
    expect(await tenant.auditoriaWhatsapp.count()).toBeGreaterThanOrEqual(4);
  });

  it('valida payloads e conta inexistente', async () => {
    await request(app()).post('/contas').send({ nome: 'x' }).expect(422);
    await request(app()).get('/contas/40ca22c9-5435-4bb7-81a2-27ee3dfb6277').expect(404);
  });
});

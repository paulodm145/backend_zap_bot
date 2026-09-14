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
import { EvolutionApiService } from '../src/services/evolution-api.service.js';

const urlCentral = process.env.TEST_DATABASE_URL;
const urlTenant = process.env.TEST_TENANT_DATABASE_URL_A;
const descreverIntegracao = urlCentral && urlTenant ? describe : describe.skip;

descreverIntegracao('API de contas WhatsApp', () => {
  const central = new PrismaCentral({ adapter: new PrismaPg(urlCentral ?? '') });
  const tenant = new PrismaTenant({ adapter: new PrismaPg(urlTenant ?? '') });
  let tenantId = 0;
  const usuarioId = '40ca22c9-5435-4bb7-81a2-27ee3dfb6277';

  function caminho(url: string): string {
    return new URL(url).pathname;
  }

  const executarFetch = vi.fn<typeof fetch>().mockImplementation((entrada) => {
    const url =
      typeof entrada === 'string'
        ? entrada
        : entrada instanceof URL
          ? entrada.toString()
          : entrada.url;
    const rota = caminho(url);
    if (rota === '/instance/create') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            instance: { instanceName: 'x', instanceId: 'evo-instance-teste', status: 'connecting' },
            hash: 'apikey-gerada-pela-evolution',
            qrcode: { base64: 'data:image/png;base64,QRCODE' },
          }),
          { status: 200 },
        ),
      );
    }
    if (rota.startsWith('/webhook/set/')) {
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    }
    if (rota.startsWith('/instance/connect/')) {
      return Promise.resolve(
        new Response(JSON.stringify({ base64: 'data:image/png;base64,NOVOQR' }), { status: 200 }),
      );
    }
    if (rota.startsWith('/instance/logout/')) {
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
  });

  beforeEach(async () => {
    executarFetch.mockClear();
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
          new EvolutionApiService(
            'https://evolution.test',
            'chave-global-teste',
            'http://api.test',
            executarFetch,
          ),
        ),
      ),
    );
    aplicacao.use(tratarErro);
    return aplicacao;
  }

  it('executa onboarding por QR code, edição, reconexão e desativação sem expor segredo', async () => {
    const criado = await request(app()).post('/contas').send({ nome: 'Principal' }).expect(201);
    const corpoCriado = criado.body as unknown as {
      conta: { public_id: string; instance_name: string; status: string };
      qrCodeBase64: string;
    };
    const contaId = corpoCriado.conta.public_id;
    expect(corpoCriado.conta).not.toHaveProperty('api_key_encrypted');
    expect(corpoCriado.conta.status).toBe('CONECTANDO');
    expect(corpoCriado.qrCodeBase64).toBe('data:image/png;base64,QRCODE');
    expect(
      await central.roteamentoWhatsapp.findUnique({
        where: { instance_name: corpoCriado.conta.instance_name },
      }),
    ).toMatchObject({ tenant_id: tenantId });

    const lista = await request(app()).get('/contas?skip=0&take=20&busca=Princ').expect(200);
    expect((lista.body as unknown as { total: number }).total).toBe(1);
    await request(app()).get(`/contas/${contaId}`).expect(200);
    await request(app()).put(`/contas/${contaId}`).send({ nome: 'Principal editada' }).expect(200);

    const reconectado = await request(app()).post(`/contas/${contaId}/reconectar`).expect(200);
    expect((reconectado.body as unknown as { qrCodeBase64: string }).qrCodeBase64).toBe(
      'data:image/png;base64,NOVOQR',
    );

    const desconectado = await request(app()).post(`/contas/${contaId}/desconectar`).expect(200);
    expect((desconectado.body as unknown as { status: string }).status).toBe('DESCONECTADO');

    await request(app()).patch(`/contas/${contaId}/status`).send({ ativo: false }).expect(200);
    expect(await tenant.auditoriaWhatsapp.count()).toBeGreaterThanOrEqual(2);

    await request(app()).delete(`/contas/${contaId}`).expect(204);
    await request(app()).get(`/contas/${contaId}`).expect(404);
    const excluida = await tenant.contaWhatsapp.findUnique({
      where: { public_id: contaId },
    });
    expect(excluida).toMatchObject({ ativo: false });
    expect(excluida?.deletado_at).not.toBeNull();
    expect(
      await tenant.auditoriaWhatsapp.count({
        where: { conta_public_id: contaId, acao: 'EXCLUIR' },
      }),
    ).toBe(1);
    // Repetir a exclusão não encontra mais a conta ativa (soft delete já aplicado).
    await request(app()).delete(`/contas/${contaId}`).expect(404);
  });

  it('valida payloads e conta inexistente', async () => {
    await request(app()).post('/contas').send({ nome: 'x' }).expect(422);
    await request(app()).get('/contas/40ca22c9-5435-4bb7-81a2-27ee3dfb6277').expect(404);
  });
});

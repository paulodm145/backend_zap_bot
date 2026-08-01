import './configurar-ambiente.js';

import { PrismaPg } from '@prisma/adapter-pg';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { SetorController } from '../src/controllers/setor.controller.js';
import { PrismaClient } from '../src/generated/prisma-tenant/client.js';
import { tratarErro } from '../src/middlewares/erro.middleware.js';
import { criarRotasSetores, criarRotaVinculosSetores } from '../src/rotas/setor.rotas.js';

const url = process.env.TEST_TENANT_DATABASE_URL_A;
const descreverIntegracao = url ? describe : describe.skip;

descreverIntegracao('API de setores e vínculos', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(url ?? '') });
  let usuarioCentralPublicId = crypto.randomUUID();
  let usuarioPublicId = '';

  beforeEach(async () => {
    await prisma.mensagem.deleteMany();
    await prisma.conversa.deleteMany();
    await prisma.fluxoVersao.deleteMany();
    await prisma.fluxo.deleteMany();
    await prisma.atendenteSetor.deleteMany();
    await prisma.atendente.deleteMany();
    await prisma.usuarioTenant.deleteMany();
    await prisma.setor.deleteMany();
    await prisma.contato.deleteMany();
    await prisma.contaWhatsapp.deleteMany();
    usuarioCentralPublicId = crypto.randomUUID();
    const usuario = await prisma.usuarioTenant.create({
      data: {
        usuario_central_public_id: usuarioCentralPublicId,
        nome: 'Atendente Um',
        nome_normalizado: 'atendente um',
        email: 'atendente-setor@tenant.com',
        papel: 'ATENDENTE',
      },
    });
    usuarioPublicId = usuario.public_id;
  });

  afterAll(async () => prisma.$disconnect());

  function app(papel: 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE' = 'ADMIN_TENANT') {
    const aplicacao = express();
    aplicacao.use(express.json());
    aplicacao.use((requisicao, _resposta, proximo) => {
      requisicao.usuarioTenant = {
        id: usuarioCentralPublicId,
        email: 'atendente-setor@tenant.com',
        tenantId: crypto.randomUUID(),
        papel,
      };
      requisicao.contextoTenant = { id: 1, publicId: crypto.randomUUID(), prisma };
      proximo();
    });
    const controller = new SetorController();
    aplicacao.use('/setores', criarRotasSetores(controller));
    aplicacao.use('/usuarios', criarRotaVinculosSetores(controller));
    aplicacao.use(tratarErro);
    return aplicacao;
  }

  async function criarSetor(nome: string): Promise<string> {
    const resposta = await request(app()).post('/setores').send({ nome }).expect(201);
    return (resposta.body as unknown as { public_id: string }).public_id;
  }

  it('executa CRUD paginado, busca e soft delete', async () => {
    const setorId = await criarSetor('Financeiro');
    await request(app())
      .get('/setores?busca=finance&skip=0&take=10')
      .expect(200)
      .expect((resposta) => {
        expect(resposta.body).toMatchObject({ total: 1, skip: 0, take: 10 });
      });
    await request(app()).get(`/setores/${setorId}`).expect(200);
    await request(app()).put(`/setores/${setorId}`).send({ nome: 'Fiscal' }).expect(200);
    await request(app()).post('/setores').send({ nome: 'Fiscal' }).expect(409);
    await request(app()).delete(`/setores/${setorId}`).expect(204);
    const excluido = await prisma.setor.findUniqueOrThrow({ where: { public_id: setorId } });
    expect(excluido.ativo).toBe(false);
    expect(excluido.deletado_at).toBeInstanceOf(Date);
  });

  it('substitui atomicamente zero, um ou vários setores e limita visão do atendente', async () => {
    const fiscal = await criarSetor('Fiscal');
    const financeiro = await criarSetor('Financeiro');
    await request(app())
      .put(`/usuarios/${usuarioPublicId}/setores`)
      .send({ setoresIds: [fiscal, financeiro] })
      .expect(200);
    expect(await prisma.atendenteSetor.count()).toBe(2);
    await request(app('ATENDENTE'))
      .get('/setores')
      .expect(200)
      .expect((resposta) => {
        expect((resposta.body as unknown as { total: number }).total).toBe(2);
      });
    await request(app())
      .get(`/setores/${fiscal}/atendentes-elegiveis`)
      .expect(200)
      .expect((resposta) => {
        expect(resposta.body as unknown[]).toHaveLength(1);
      });
    await request(app())
      .put(`/usuarios/${usuarioPublicId}/setores`)
      .send({ setoresIds: [] })
      .expect(200);
    await request(app('ATENDENTE'))
      .get('/setores')
      .expect(200)
      .expect((resposta) => {
        expect((resposta.body as unknown as { total: number }).total).toBe(0);
      });
    await request(app())
      .put(`/usuarios/${usuarioPublicId}/setores`)
      .send({ setoresIds: [crypto.randomUUID()] })
      .expect(422);
  });

  it('restringe gestão por RBAC e bloqueia setor usado em fluxo publicado', async () => {
    const setorId = await criarSetor('Suporte');
    await request(app('ATENDENTE')).post('/setores').send({ nome: 'Proibido' }).expect(403);
    const fluxo = await prisma.fluxo.create({
      data: {
        nome: 'Publicado',
        definicao: {},
        ativo: true,
        versao: 1,
        possui_alteracoes_nao_publicadas: false,
      },
    });
    await prisma.fluxoVersao.create({
      data: { fluxo_id: fluxo.id, versao: 1, definicao: { nos: [{ dados: { setorId } }] } },
    });
    await request(app()).delete(`/setores/${setorId}`).expect(409);
  });

  it('bloqueia exclusão de setor com conversa ativa', async () => {
    const setorId = await criarSetor('Comercial');
    const setor = await prisma.setor.findUniqueOrThrow({ where: { public_id: setorId } });
    const conta = await prisma.contaWhatsapp.create({
      data: {
        nome: 'Conta',
        phone_number_id: 'phone-setor',
        waba_id: 'waba-setor',
        token_encrypted: 'segredo',
      },
    });
    const contato = await prisma.contato.create({ data: { telefone: '5511999990000' } });
    await prisma.conversa.create({
      data: {
        conta_whatsapp_id: conta.id,
        contato_id: contato.id,
        setor_id: setor.id,
        status: 'AGUARDANDO_ATENDENTE',
      },
    });
    await request(app()).delete(`/setores/${setorId}`).expect(409);
  });
});

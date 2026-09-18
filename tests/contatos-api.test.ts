import './configurar-ambiente.js';

import { PrismaPg } from '@prisma/adapter-pg';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { ContatoController } from '../src/controllers/contato.controller.js';
import { PrismaClient } from '../src/generated/prisma-tenant/client.js';
import { tratarErro } from '../src/middlewares/erro.middleware.js';
import { criarRotasContatos } from '../src/rotas/contato.rotas.js';

const url = process.env.TEST_TENANT_DATABASE_URL_B;
const descreverIntegracao = url ? describe : describe.skip;

descreverIntegracao('API de contatos', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(url ?? '') });
  let usuarioCentralPublicId = crypto.randomUUID();

  beforeEach(async () => {
    await prisma.movimentacaoAtendimento.deleteMany();
    await prisma.mensagem.deleteMany();
    await prisma.conversa.deleteMany();
    await prisma.atendenteSetor.deleteMany();
    await prisma.atendente.deleteMany();
    await prisma.usuarioTenant.deleteMany();
    await prisma.setor.deleteMany();
    await prisma.contato.deleteMany();
    await prisma.auditoriaWhatsapp.deleteMany();
    await prisma.contaWhatsapp.deleteMany();
    usuarioCentralPublicId = crypto.randomUUID();
    await prisma.usuarioTenant.create({
      data: {
        usuario_central_public_id: usuarioCentralPublicId,
        nome: 'Atendente Direto',
        nome_normalizado: 'atendente direto',
        email: 'contatos@tenant.com',
        papel: 'ATENDENTE',
      },
    });
  });

  afterAll(async () => prisma.$disconnect());

  function app(papel: 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE' = 'ADMIN_TENANT') {
    const aplicacao = express();
    aplicacao.use(express.json());
    aplicacao.use((requisicao, _resposta, proximo) => {
      requisicao.usuarioTenant = {
        id: usuarioCentralPublicId,
        email: 'contatos@tenant.com',
        tenantId: crypto.randomUUID(),
        papel,
      };
      requisicao.contextoTenant = { id: 1, publicId: crypto.randomUUID(), prisma };
      proximo();
    });
    aplicacao.use('/contatos', criarRotasContatos(new ContatoController()));
    aplicacao.use(tratarErro);
    return aplicacao;
  }

  async function criarAtendente(): Promise<number> {
    const usuario = await prisma.usuarioTenant.findFirstOrThrow({
      where: { usuario_central_public_id: usuarioCentralPublicId },
    });
    const atendente = await prisma.atendente.create({
      data: { usuario_tenant_id: usuario.id, nome: usuario.nome, email: usuario.email },
    });
    return atendente.id;
  }

  async function criarContaConectada(nome = 'Principal'): Promise<{ id: number; publicId: string }> {
    const conta = await prisma.contaWhatsapp.create({
      data: {
        nome,
        instance_name: `instancia-${nome}-${String(Date.now())}-${String(Math.random())}`,
        api_key_encrypted: 'segredo',
        status: 'CONECTADO',
      },
    });
    return { id: conta.id, publicId: conta.public_id };
  }

  it('executa CRUD, busca por nome/telefone e soft delete', async () => {
    const criado = await request(app())
      .post('/contatos')
      .send({ nome: 'Maria Cliente', telefone: '5511988887777' })
      .expect(201);
    const contatoId = (criado.body as { public_id: string }).public_id;
    expect(criado.body).toMatchObject({ nome: 'Maria Cliente', telefone: '+5511988887777' });

    await request(app())
      .get('/contatos?busca=maria')
      .expect(200)
      .expect((resposta) => {
        expect(resposta.body).toMatchObject({ total: 1 });
      });
    await request(app())
      .get('/contatos?busca=988887777')
      .expect(200)
      .expect((resposta) => {
        expect(resposta.body).toMatchObject({ total: 1 });
      });
    await request(app()).get(`/contatos/${contatoId}`).expect(200);

    await request(app())
      .put(`/contatos/${contatoId}`)
      .send({ nome: 'Maria Atualizada' })
      .expect(200)
      .expect((resposta) => {
        expect(resposta.body).toMatchObject({ nome: 'Maria Atualizada' });
      });

    // Formatação diferente (parênteses, espaço) do mesmo número já cadastrado
    // ainda deve colidir — a normalização acontece antes da checagem.
    await request(app()).post('/contatos').send({ telefone: '+55 (11) 98888-7777' }).expect(409);

    await request(app()).delete(`/contatos/${contatoId}`).expect(204);
    const excluido = await prisma.contato.findUniqueOrThrow({ where: { public_id: contatoId } });
    expect(excluido.ativo).toBe(false);
    expect(excluido.deletado_at).toBeInstanceOf(Date);
  });

  it('recusa telefone inválido e bloqueia exclusão com conversa ativa', async () => {
    await request(app()).post('/contatos').send({ telefone: '123' }).expect(422);

    const contato = await prisma.contato.create({ data: { telefone: '+5511999990000' } });
    const conta = await criarContaConectada();
    await prisma.conversa.create({
      data: { conta_whatsapp_id: conta.id, contato_id: contato.id, status: 'BOT' },
    });
    await request(app()).delete(`/contatos/${contato.public_id}`).expect(409);
  });

  it('restringe criação/edição/exclusão por RBAC, mas permite leitura ao atendente', async () => {
    await request(app('ATENDENTE'))
      .post('/contatos')
      .send({ telefone: '11988887777' })
      .expect(403);
    const contato = await prisma.contato.create({ data: { telefone: '+5511988887777' } });
    await request(app('ATENDENTE')).get('/contatos').expect(200);
    await request(app('ATENDENTE')).get(`/contatos/${contato.public_id}`).expect(200);
    await request(app('ATENDENTE'))
      .put(`/contatos/${contato.public_id}`)
      .send({ nome: 'Não permitido' })
      .expect(403);
    await request(app('ATENDENTE')).delete(`/contatos/${contato.public_id}`).expect(403);
  });

  it('inicia conversa nova com o contato quando não há nenhuma em andamento', async () => {
    await criarAtendente();
    const conta = await criarContaConectada();
    const contato = await prisma.contato.create({ data: { telefone: '+5511977776666' } });

    const resposta = await request(app('ATENDENTE'))
      .post(`/contatos/${contato.public_id}/conversas`)
      .send({})
      .expect(201);
    expect(resposta.body).toMatchObject({ status: 'COM_ATENDENTE', janelaAberta: false });

    const conversa = await prisma.conversa.findFirstOrThrow({ where: { contato_id: contato.id } });
    expect(conversa.conta_whatsapp_id).toBe(conta.id);
    expect(conversa.status).toBe('COM_ATENDENTE');

    // Chamar de novo pelo mesmo atendente é idempotente: devolve a mesma conversa.
    const segunda = await request(app('ATENDENTE'))
      .post(`/contatos/${contato.public_id}/conversas`)
      .send({})
      .expect(201);
    expect(segunda.body).toMatchObject({ conversaId: conversa.public_id });
    expect(await prisma.conversa.count({ where: { contato_id: contato.id } })).toBe(1);
  });

  it('reivindica conversa aberta sem atendente em vez de criar uma nova', async () => {
    await criarAtendente();
    const conta = await criarContaConectada();
    const contato = await prisma.contato.create({ data: { telefone: '+5511966665555' } });
    const existente = await prisma.conversa.create({
      data: {
        conta_whatsapp_id: conta.id,
        contato_id: contato.id,
        status: 'BOT',
        janela_expira_at: new Date(Date.now() + 60_000),
      },
    });

    const resposta = await request(app('ATENDENTE'))
      .post(`/contatos/${contato.public_id}/conversas`)
      .send({})
      .expect(201);
    expect(resposta.body).toMatchObject({
      conversaId: existente.public_id,
      status: 'COM_ATENDENTE',
      janelaAberta: true,
    });
    expect(await prisma.conversa.count({ where: { contato_id: contato.id } })).toBe(1);
  });

  it('recusa quando a conversa do contato já tem outro atendente responsável', async () => {
    await criarAtendente();
    const outroUsuario = await prisma.usuarioTenant.create({
      data: {
        usuario_central_public_id: crypto.randomUUID(),
        nome: 'Outro Atendente',
        nome_normalizado: 'outro atendente',
        email: 'outro@tenant.com',
        papel: 'ATENDENTE',
      },
    });
    const outroAtendente = await prisma.atendente.create({
      data: { usuario_tenant_id: outroUsuario.id, nome: outroUsuario.nome, email: outroUsuario.email },
    });
    const conta = await criarContaConectada();
    const contato = await prisma.contato.create({ data: { telefone: '+5511955554444' } });
    await prisma.conversa.create({
      data: {
        conta_whatsapp_id: conta.id,
        contato_id: contato.id,
        status: 'COM_ATENDENTE',
        atendente_id: outroAtendente.id,
      },
    });

    await request(app('ATENDENTE'))
      .post(`/contatos/${contato.public_id}/conversas`)
      .send({})
      .expect(409);
  });

  it('exige perfil de atendente ativo e conta WhatsApp conectada', async () => {
    const contato = await prisma.contato.create({ data: { telefone: '+5511944443333' } });
    await request(app('ATENDENTE'))
      .post(`/contatos/${contato.public_id}/conversas`)
      .send({})
      .expect(403);

    await criarAtendente();
    await request(app('ATENDENTE'))
      .post(`/contatos/${contato.public_id}/conversas`)
      .send({})
      .expect(422);

    await criarContaConectada('Uma');
    await criarContaConectada('Duas');
    await request(app('ATENDENTE'))
      .post(`/contatos/${contato.public_id}/conversas`)
      .send({})
      .expect(422);
  });
});

import './configurar-ambiente.js';
import { PrismaPg } from '@prisma/adapter-pg';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DirecionamentoAtendimentoController } from '../src/controllers/direcionamento-atendimento.controller.js';
import { HistoricoController } from '../src/controllers/historico.controller.js';
import { PrismaClient } from '../src/generated/prisma-tenant/client.js';
import { tratarErro } from '../src/middlewares/erro.middleware.js';
import { criarRotasConversas } from '../src/rotas/historico.rotas.js';
import { DirecionamentoAtendimentoRepository } from '../src/repositories/direcionamento-atendimento.repository.js';

const url = process.env.TEST_TENANT_DATABASE_URL_B;
const descreverIntegracao = url ? describe : describe.skip;

descreverIntegracao('direcionamento de atendimento', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(url ?? '') });
  const usuarioUm = crypto.randomUUID();
  const usuarioDois = crypto.randomUUID();
  const usuarioGestor = crypto.randomUUID();
  let conversaId = '';
  let setorId = '';
  let atendenteDoisId = '';

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
    const conta = await prisma.contaWhatsapp.create({
      data: {
        nome: 'Conta Atendimento',
        phone_number_id: 'phone-atendimento',
        waba_id: 'waba-atendimento',
        token_encrypted: 'segredo',
      },
    });
    const setor = await prisma.setor.create({
      data: { nome: 'Comercial', nome_normalizado: 'comercial' },
    });
    setorId = setor.public_id;
    for (const [indice, publicId] of [usuarioUm, usuarioDois].entries()) {
      const usuario = await prisma.usuarioTenant.create({
        data: {
          usuario_central_public_id: publicId,
          nome: `Atendente ${String(indice + 1)}`,
          nome_normalizado: `atendente ${String(indice + 1)}`,
          email: `atendente${String(indice + 1)}@teste.com`,
          papel: 'ATENDENTE',
        },
      });
      const atendente = await prisma.atendente.create({
        data: { usuario_tenant_id: usuario.id, nome: usuario.nome, email: usuario.email },
      });
      await prisma.atendenteSetor.create({
        data: { atendente_id: atendente.id, setor_id: setor.id },
      });
      if (indice === 1) atendenteDoisId = atendente.public_id;
    }
    const contato = await prisma.contato.create({ data: { telefone: '+5511999990000' } });
    const conversa = await prisma.conversa.create({
      data: {
        conta_whatsapp_id: conta.id,
        contato_id: contato.id,
        setor_id: setor.id,
        status: 'AGUARDANDO_ATENDENTE',
        estado_fluxo: { fluxoVersaoId: crypto.randomUUID(), noAtualId: null, variaveis: {} },
      },
    });
    conversaId = conversa.public_id;
  });

  afterAll(async () => prisma.$disconnect());

  function app(
    usuarioCentralPublicId: string,
    papel: 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE' = 'ATENDENTE',
  ) {
    const aplicacao = express();
    aplicacao.use(express.json());
    aplicacao.use((requisicao, _resposta, proximo) => {
      requisicao.usuarioTenant = {
        id: usuarioCentralPublicId,
        email: 'usuario@teste.com',
        tenantId: crypto.randomUUID(),
        papel,
      };
      requisicao.contextoTenant = { id: 1, publicId: crypto.randomUUID(), prisma };
      proximo();
    });
    aplicacao.use(
      '/conversas',
      criarRotasConversas(new HistoricoController(), new DirecionamentoAtendimentoController()),
    );
    aplicacao.use(tratarErro);
    return aplicacao;
  }

  it('permite que apenas um atendente vença o claim concorrente', async () => {
    const respostas = await Promise.all([
      request(app(usuarioUm)).post(`/conversas/${conversaId}/assumir`),
      request(app(usuarioDois)).post(`/conversas/${conversaId}/assumir`),
    ]);
    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 409]);
    expect(await prisma.movimentacaoAtendimento.count({ where: { acao: 'ASSUMIU' } })).toBe(1);
    const vencedor = respostas[0].status === 200 ? usuarioUm : usuarioDois;
    const minhas = await request(app(vencedor)).get('/conversas?visao=MINHAS').expect(200);
    const fila = await request(app(vencedor)).get('/conversas?visao=FILA').expect(200);
    expect((minhas.body as unknown as { total: number }).total).toBe(1);
    expect((fila.body as unknown as { total: number }).total).toBe(0);
  });

  it('persiste direcionamento do fluxo, snapshot e evento de sistema', async () => {
    const outroSetor = await prisma.setor.create({
      data: { nome: 'Suporte', nome_normalizado: 'suporte' },
    });
    const estado = {
      fluxoVersaoId: crypto.randomUUID(),
      noAtualId: null,
      variaveis: { protocolo: '123' },
      concluido: true,
      passosExecutados: 2,
    };
    await expect(
      new DirecionamentoAtendimentoRepository(prisma).direcionarPeloFluxo(
        conversaId,
        outroSetor.public_id,
        estado,
      ),
    ).resolves.toBe(true);
    expect(
      await prisma.conversa.findUniqueOrThrow({ where: { public_id: conversaId } }),
    ).toMatchObject({
      status: 'AGUARDANDO_ATENDENTE',
      setor_id: outroSetor.id,
      estado_fluxo: estado,
    });
    expect(
      await prisma.mensagem.count({
        where: { conversa: { public_id: conversaId }, tipo: 'SISTEMA' },
      }),
    ).toBe(1);
  });

  it('nega claim para atendente sem vínculo com o setor', async () => {
    const usuario = await prisma.usuarioTenant.create({
      data: {
        usuario_central_public_id: crypto.randomUUID(),
        nome: 'Sem setor',
        nome_normalizado: 'sem setor',
        email: 'semsetor@teste.com',
        papel: 'ATENDENTE',
      },
    });
    await prisma.atendente.create({
      data: { usuario_tenant_id: usuario.id, nome: usuario.nome, email: usuario.email },
    });
    await request(app(usuario.usuario_central_public_id))
      .post(`/conversas/${conversaId}/assumir`)
      .expect(403);
  });

  it('reatribui com auditoria completa e permite devolver ao bot', async () => {
    await request(app(usuarioUm)).post(`/conversas/${conversaId}/assumir`).expect(200);
    await request(app(usuarioGestor, 'GESTOR'))
      .post(`/conversas/${conversaId}/reatribuir`)
      .send({ setorId, atendenteId: atendenteDoisId, motivo: 'Redistribuição operacional' })
      .expect(200);
    const auditoria = await prisma.movimentacaoAtendimento.findFirstOrThrow({
      where: { acao: 'REATRIBUIU' },
    });
    expect(auditoria).toMatchObject({
      motivo: 'Redistribuição operacional',
      autor_usuario_public_id: usuarioGestor,
    });
    expect(typeof auditoria.origem_atendente_id).toBe('number');
    expect(typeof auditoria.destino_atendente_id).toBe('number');
    expect(typeof auditoria.origem_setor_id).toBe('number');
    expect(typeof auditoria.destino_setor_id).toBe('number');
    const encerramento = await request(app(usuarioGestor, 'GESTOR'))
      .post(`/conversas/${conversaId}/encerrar`)
      .send({ devolverAoBot: true, motivo: 'Retomar automação' })
      .expect(200);
    const corpo = encerramento.body as unknown as {
      status: string;
      estadoFluxoRestaurado: unknown;
    };
    expect(corpo.status).toBe('BOT');
    expect(corpo.estadoFluxoRestaurado).toBeTruthy();
    expect(
      await prisma.conversa.findUniqueOrThrow({ where: { public_id: conversaId } }),
    ).toMatchObject({ status: 'BOT', atendente_id: null, setor_id: null });
    expect(
      await prisma.mensagem.count({
        where: { conversa: { public_id: conversaId }, tipo: 'SISTEMA' },
      }),
    ).toBe(3);
  });
});

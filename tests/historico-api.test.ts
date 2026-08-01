import './configurar-ambiente.js';
import { PrismaPg } from '@prisma/adapter-pg';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HistoricoController } from '../src/controllers/historico.controller.js';
import { PrismaClient } from '../src/generated/prisma-tenant/client.js';
import { HistoricoRepository } from '../src/repositories/historico.repository.js';
import { tratarErro } from '../src/middlewares/erro.middleware.js';
import { criarRotasContatos, criarRotasConversas } from '../src/rotas/historico.rotas.js';

const url = process.env.TEST_TENANT_DATABASE_URL_B;
const descreverIntegracao = url ? describe : describe.skip;

descreverIntegracao('histórico de conversas', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(url ?? '') });
  const centralPublicId = crypto.randomUUID();
  let contaId = 0;
  let conversaVisivelId = '';

  beforeEach(async () => {
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
        nome: 'Principal',
        phone_number_id: 'phone-historico',
        waba_id: 'waba-historico',
        token_encrypted: 'segredo',
        ativo: true,
      },
    });
    contaId = conta.id;
    const usuario = await prisma.usuarioTenant.create({
      data: {
        usuario_central_public_id: centralPublicId,
        nome: 'Atendente',
        nome_normalizado: 'atendente',
        email: 'historico@tenant.com',
        papel: 'ATENDENTE',
      },
    });
    const atendente = await prisma.atendente.create({
      data: { usuario_tenant_id: usuario.id, nome: usuario.nome, email: usuario.email },
    });
    const setor = await prisma.setor.create({
      data: { nome: 'Fiscal', nome_normalizado: 'fiscal' },
    });
    await prisma.atendenteSetor.create({
      data: { atendente_id: atendente.id, setor_id: setor.id },
    });
    const contato = await prisma.contato.create({
      data: {
        nome: 'Cliente Visível',
        nome_normalizado: 'cliente visivel',
        telefone: '+5511999991111',
      },
    });
    const conversa = await prisma.conversa.create({
      data: {
        conta_whatsapp_id: conta.id,
        contato_id: contato.id,
        setor_id: setor.id,
        status: 'AGUARDANDO_ATENDENTE',
        ultima_mensagem_at: new Date('2026-08-01T12:00:00Z'),
        estado_fluxo: { etapa: 'captura' },
      },
    });
    conversaVisivelId = conversa.public_id;
    for (let indice = 1; indice <= 3; indice += 1) {
      await prisma.mensagem.create({
        data: {
          conversa_id: conversa.id,
          tipo: 'TEXTO',
          direcao: 'ENTRADA',
          autor: 'CONTATO',
          status_entrega: 'RECEBIDA',
          recebida: true,
          conteudo: { texto: `Mensagem ${String(indice)}` },
          ocorreu_at: new Date('2026-08-01T12:00:00Z'),
        },
      });
    }
    const outroSetor = await prisma.setor.create({
      data: { nome: 'Privado', nome_normalizado: 'privado' },
    });
    const outroContato = await prisma.contato.create({
      data: { nome: 'Oculto', nome_normalizado: 'oculto', telefone: '+5511999992222' },
    });
    await prisma.conversa.create({
      data: {
        conta_whatsapp_id: conta.id,
        contato_id: outroContato.id,
        setor_id: outroSetor.id,
        status: 'AGUARDANDO_ATENDENTE',
      },
    });
  });

  afterAll(async () => prisma.$disconnect());

  function app(papel: 'ADMIN_TENANT' | 'ATENDENTE') {
    const aplicacao = express();
    aplicacao.use(express.json());
    aplicacao.use((requisicao, _resposta, proximo) => {
      requisicao.usuarioTenant = {
        id: centralPublicId,
        email: 'historico@tenant.com',
        tenantId: crypto.randomUUID(),
        papel,
      };
      requisicao.contextoTenant = { id: 1, publicId: crypto.randomUUID(), prisma };
      proximo();
    });
    const controller = new HistoricoController();
    aplicacao.use('/contatos', criarRotasContatos(controller));
    aplicacao.use('/conversas', criarRotasConversas(controller));
    aplicacao.use(tratarErro);
    return aplicacao;
  }

  it('persiste job com telefone normalizado e evita reentrega duplicada', async () => {
    const repositorio = new HistoricoRepository(prisma);
    const job = {
      tenantId: crypto.randomUUID(),
      phoneNumberId: 'phone-historico',
      mensagemId: 'wamid-unica',
      remetente: '55 (11) 98888-7777',
      timestamp: '1785585600',
      tipo: 'text' as const,
      texto: 'Olá',
    };
    const resultados = await Promise.all([
      repositorio.persistirRecebida(job, new Date('2026-08-01T12:00:00Z')),
      repositorio.persistirRecebida(job, new Date('2026-08-01T12:00:00Z')),
    ]);
    expect(resultados.sort()).toEqual(['CRIADA', 'DUPLICADA']);
    expect(await prisma.contato.count({ where: { telefone: '+5511988887777' } })).toBe(1);
    expect(await prisma.mensagem.count({ where: { whatsapp_message_id: 'wamid-unica' } })).toBe(1);
  });

  it('encerra janela expirada e cria nova conversa', async () => {
    const repositorio = new HistoricoRepository(prisma);
    const contato = await prisma.contato.create({ data: { telefone: '+5511988877665' } });
    await prisma.conversa.create({
      data: {
        conta_whatsapp_id: contaId,
        contato_id: contato.id,
        status: 'BOT',
        janela_expira_at: new Date('2026-07-30T00:00:00Z'),
      },
    });
    await repositorio.persistirRecebida(
      {
        tenantId: crypto.randomUUID(),
        phoneNumberId: 'phone-historico',
        mensagemId: 'wamid-janela',
        remetente: contato.telefone,
        timestamp: '1785585600',
        tipo: 'text',
        texto: 'Nova janela',
      },
      new Date('2026-08-01T12:00:00Z'),
    );
    expect(await prisma.conversa.count({ where: { contato_id: contato.id } })).toBe(2);
    expect(
      await prisma.conversa.count({ where: { contato_id: contato.id, status: 'ENCERRADA' } }),
    ).toBe(1);
  });

  it('aplica escopo de setores e filtros no histórico', async () => {
    await request(app('ATENDENTE'))
      .get('/contatos?skip=0&take=20')
      .expect(200)
      .expect((resposta) => {
        expect((resposta.body as unknown as { total: number }).total).toBe(1);
      });
    await request(app('ATENDENTE'))
      .get('/conversas?status=AGUARDANDO_ATENDENTE&busca=cliente')
      .expect(200)
      .expect((resposta) => {
        expect((resposta.body as unknown as { total: number }).total).toBe(1);
      });
    await request(app('ADMIN_TENANT'))
      .get('/conversas')
      .expect(200)
      .expect((resposta) => {
        expect((resposta.body as unknown as { total: number }).total).toBeGreaterThanOrEqual(2);
      });
    await request(app('ATENDENTE'))
      .get(`/conversas/${conversaVisivelId}`)
      .expect(200)
      .expect((resposta) => {
        expect(resposta.body).toMatchObject({ estado_fluxo: { etapa: 'captura' } });
      });
  });

  it('pagina timeline reversa de forma estável sem duplicar mensagens', async () => {
    const primeira = await request(app('ATENDENTE'))
      .get(`/conversas/${conversaVisivelId}/mensagens?take=2`)
      .expect(200);
    const corpoUm = primeira.body as unknown as {
      dados: { public_id: string }[];
      proximoCursor: string;
    };
    expect(corpoUm.dados).toHaveLength(2);
    const segunda = await request(app('ATENDENTE'))
      .get(
        `/conversas/${conversaVisivelId}/mensagens?take=2&cursor=${encodeURIComponent(corpoUm.proximoCursor)}`,
      )
      .expect(200);
    const corpoDois = segunda.body as unknown as { dados: { public_id: string }[] };
    expect(corpoDois.dados).toHaveLength(1);
    expect(new Set([...corpoUm.dados, ...corpoDois.dados].map((item) => item.public_id)).size).toBe(
      3,
    );
  });
});

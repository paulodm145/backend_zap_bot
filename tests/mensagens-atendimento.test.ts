import './configurar-ambiente.js';
import { PrismaPg } from '@prisma/adapter-pg';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirecionamentoAtendimentoController } from '../src/controllers/direcionamento-atendimento.controller.js';
import { HistoricoController } from '../src/controllers/historico.controller.js';
import { MensagemAtendimentoController } from '../src/controllers/mensagem-atendimento.controller.js';
import { PrismaClient } from '../src/generated/prisma-tenant/client.js';
import { tratarErro } from '../src/middlewares/erro.middleware.js';
import { criarRotasConversas } from '../src/rotas/historico.rotas.js';
import type { GerenciadorConexoesTenant } from '../src/database/gerenciador-conexoes-tenant.js';
import type { TenantCentralRepository } from '../src/repositories/tenant-central.repository.js';
import type { CriptografiaService } from '../src/services/criptografia.service.js';
import { ProcessadorStatusWhatsappService } from '../src/services/status-whatsapp.service.js';
import { ProcessadorMensagemSaidaService } from '../src/services/processador-mensagem-saida.service.js';
import {
  ErroEnvioWhatsapp,
  type WhatsappGraphApiService,
} from '../src/services/whatsapp-graph-api.service.js';

const url = process.env.TEST_TENANT_DATABASE_URL_B;
const descreverIntegracao = url ? describe : describe.skip;

descreverIntegracao('mensagens manuais de atendimento', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(url ?? '') });
  const usuarioPublicId = crypto.randomUUID();
  const tenantId = crypto.randomUUID();
  const adicionar = vi.fn().mockResolvedValue(undefined);
  let conversaId = '';

  beforeEach(async () => {
    adicionar.mockClear();
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
        nome: 'Envio',
        phone_number_id: 'phone-envio',
        waba_id: 'waba-envio',
        token_encrypted: 'token',
        status: 'VALIDADA',
        ativo: true,
      },
    });
    const usuario = await prisma.usuarioTenant.create({
      data: {
        usuario_central_public_id: usuarioPublicId,
        nome: 'Responsável',
        nome_normalizado: 'responsavel',
        email: 'responsavel@teste.com',
        papel: 'ATENDENTE',
      },
    });
    const atendente = await prisma.atendente.create({
      data: { usuario_tenant_id: usuario.id, nome: usuario.nome, email: usuario.email },
    });
    const contato = await prisma.contato.create({ data: { telefone: '+5511999999999' } });
    const conversa = await prisma.conversa.create({
      data: {
        conta_whatsapp_id: conta.id,
        contato_id: contato.id,
        atendente_id: atendente.id,
        status: 'COM_ATENDENTE',
        janela_expira_at: new Date(Date.now() + 3_600_000),
      },
    });
    conversaId = conversa.public_id;
  });

  afterAll(async () => prisma.$disconnect());

  function app(usuarioId = usuarioPublicId) {
    const aplicacao = express();
    aplicacao.use(express.json());
    aplicacao.use((requisicao, _resposta, proximo) => {
      requisicao.correlationId = 'corr-teste';
      requisicao.usuarioTenant = {
        id: usuarioId,
        email: 'teste@teste.com',
        tenantId,
        papel: 'ATENDENTE',
      };
      requisicao.contextoTenant = { id: 1, publicId: tenantId, prisma };
      proximo();
    });
    aplicacao.use(
      '/conversas',
      criarRotasConversas(
        new HistoricoController(),
        new DirecionamentoAtendimentoController(),
        new MensagemAtendimentoController({ adicionar }),
      ),
    );
    aplicacao.use(tratarErro);
    return aplicacao;
  }

  it('persiste antes de enfileirar e deduplica pela chave do cliente', async () => {
    const corpo = { tipo: 'TEXTO', texto: 'Olá', chaveIdempotencia: 'cliente-msg-0001' };
    const primeira = await request(app())
      .post(`/conversas/${conversaId}/mensagens`)
      .send(corpo)
      .expect(202);
    const segunda = await request(app())
      .post(`/conversas/${conversaId}/mensagens`)
      .send(corpo)
      .expect(200);
    const primeiraBody = primeira.body as unknown as { public_id: string; status_entrega: string };
    expect(primeiraBody.status_entrega).toBe('PENDENTE');
    expect(
      await prisma.mensagem.count({ where: { chave_idempotencia: corpo.chaveIdempotencia } }),
    ).toBe(1);
    expect(adicionar).toHaveBeenCalledTimes(1);
    expect(adicionar).toHaveBeenCalledWith(tenantId, primeiraBody.public_id);
    expect((segunda.body as unknown as { duplicada: boolean }).duplicada).toBe(true);
  });

  it('bloqueia outro atendente e janela expirada', async () => {
    await request(app(crypto.randomUUID()))
      .post(`/conversas/${conversaId}/mensagens`)
      .send({ tipo: 'TEXTO', texto: 'Não pode', chaveIdempotencia: 'cliente-msg-0002' })
      .expect(403);
    await prisma.conversa.update({
      where: { public_id: conversaId },
      data: { janela_expira_at: new Date(0) },
    });
    await request(app())
      .post(`/conversas/${conversaId}/mensagens`)
      .send({ tipo: 'TEXTO', texto: 'Fora da janela', chaveIdempotencia: 'cliente-msg-0003' })
      .expect(422);
  });

  it('aplica status da Meta sem regredir a leitura', async () => {
    const conversa = await prisma.conversa.findUniqueOrThrow({ where: { public_id: conversaId } });
    await prisma.mensagem.create({
      data: {
        conversa_id: conversa.id,
        whatsapp_message_id: 'wamid.status',
        tipo: 'TEXTO',
        direcao: 'SAIDA',
        autor: 'ATENDENTE',
        status_entrega: 'ENVIADA',
        conteudo: { texto: 'Status' },
        recebida: false,
        ocorreu_at: new Date(),
      },
    });
    const processador = new ProcessadorStatusWhatsappService(
      {
        buscarPorPublicId: () =>
          Promise.resolve({ id: 1, status: 'ATIVO', string_conexao_encrypted: 'conexao' }),
      } as unknown as TenantCentralRepository,
      { descriptografar: () => 'postgresql://tenant' } as unknown as CriptografiaService,
      { obter: () => Promise.resolve(prisma) } as unknown as GerenciadorConexoesTenant,
    );
    await expect(
      processador.processar({ tenantId, mensagemId: 'wamid.status', status: 'read' }),
    ).resolves.toBe('ATUALIZADA');
    await expect(
      processador.processar({ tenantId, mensagemId: 'wamid.status', status: 'delivered' }),
    ).resolves.toBe('IGNORADA');
    expect(
      await prisma.mensagem.findUniqueOrThrow({ where: { whatsapp_message_id: 'wamid.status' } }),
    ).toMatchObject({ status_entrega: 'LIDA' });
  });

  it('envia pela conta da conversa, grava ID Meta e não repete job concluído', async () => {
    const conversa = await prisma.conversa.findUniqueOrThrow({ where: { public_id: conversaId } });
    const mensagem = await prisma.mensagem.create({
      data: {
        conversa_id: conversa.id,
        tipo: 'TEXTO',
        direcao: 'SAIDA',
        autor: 'ATENDENTE',
        status_entrega: 'PENDENTE',
        conteudo: { texto: 'Enviar' },
        recebida: false,
        ocorreu_at: new Date(),
      },
    });
    const enviar = vi.fn().mockResolvedValue('wamid.meta-saida');
    const processador = new ProcessadorMensagemSaidaService(
      {
        buscarPorPublicId: () =>
          Promise.resolve({ id: 1, status: 'ATIVO', string_conexao_encrypted: 'conexao' }),
      } as unknown as TenantCentralRepository,
      { descriptografar: () => 'postgresql://tenant' } as unknown as CriptografiaService,
      { descriptografar: () => 'token-aberto' } as unknown as CriptografiaService,
      { obter: () => Promise.resolve(prisma) } as unknown as GerenciadorConexoesTenant,
      { enviar } as unknown as WhatsappGraphApiService,
    );
    const job = { tenantId, mensagemPublicId: mensagem.public_id };
    await expect(processador.processar(job)).resolves.toBe('ENVIADA');
    await expect(processador.processar(job)).resolves.toBe('JA_PROCESSADA');
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledWith(
      'phone-envio',
      'v23.0',
      'token-aberto',
      expect.objectContaining({ destinatario: '+5511999999999', texto: 'Enviar' }),
    );
    expect(await prisma.mensagem.findUniqueOrThrow({ where: { id: mensagem.id } })).toMatchObject({
      status_entrega: 'ENVIADA',
      whatsapp_message_id: 'wamid.meta-saida',
    });
  });

  it('libera tentativa transitória e encerra falha permanente', async () => {
    const conversa = await prisma.conversa.findUniqueOrThrow({ where: { public_id: conversaId } });
    const criar = (chave: string) =>
      prisma.mensagem.create({
        data: {
          conversa_id: conversa.id,
          chave_idempotencia: chave,
          tipo: 'TEXTO',
          direcao: 'SAIDA',
          autor: 'ATENDENTE',
          status_entrega: 'PENDENTE',
          conteudo: { texto: 'Erro' },
          recebida: false,
          ocorreu_at: new Date(),
        },
      });
    const transitoria = await criar('worker-transitoria');
    const permanente = await criar('worker-permanente');
    let erro: ErroEnvioWhatsapp = new ErroEnvioWhatsapp('META_HTTP_503', true);
    const processador = new ProcessadorMensagemSaidaService(
      {
        buscarPorPublicId: () =>
          Promise.resolve({ id: 1, status: 'ATIVO', string_conexao_encrypted: 'conexao' }),
      } as unknown as TenantCentralRepository,
      { descriptografar: () => 'postgresql://tenant' } as unknown as CriptografiaService,
      { descriptografar: () => 'token' } as unknown as CriptografiaService,
      { obter: () => Promise.resolve(prisma) } as unknown as GerenciadorConexoesTenant,
      { enviar: () => Promise.reject(erro) } as unknown as WhatsappGraphApiService,
    );
    await expect(
      processador.processar({ tenantId, mensagemPublicId: transitoria.public_id }),
    ).rejects.toBe(erro);
    expect(
      (await prisma.mensagem.findUniqueOrThrow({ where: { id: transitoria.id } })).enviada_at,
    ).toBeNull();
    erro = new ErroEnvioWhatsapp('META_HTTP_400', false);
    await expect(
      processador.processar({ tenantId, mensagemPublicId: permanente.public_id }),
    ).resolves.toBe('FALHA');
    expect(await prisma.mensagem.findUniqueOrThrow({ where: { id: permanente.id } })).toMatchObject(
      { status_entrega: 'FALHA', erro_codigo: 'META_HTTP_400' },
    );
  });
});

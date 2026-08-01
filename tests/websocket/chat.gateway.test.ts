import '../configurar-ambiente.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { createServer } from 'node:http';
import express from 'express';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GerenciadorConexoesTenant } from '../../src/database/gerenciador-conexoes-tenant.js';
import { barramentoChat } from '../../src/eventos/barramento-chat.js';
import { PrismaClient } from '../../src/generated/prisma-tenant/client.js';
import { criarConexaoRedis } from '../../src/config/redis.js';
import type { TenantCentralRepository } from '../../src/repositories/tenant-central.repository.js';
import type { CriptografiaService } from '../../src/services/criptografia.service.js';
import { TokenTenantService } from '../../src/services/token-tenant.service.js';
import { ChatGateway } from '../../src/websocket/chat.gateway.js';

const bancoUrl = process.env.TEST_TENANT_DATABASE_URL_B;
const redisUrl = process.env.TEST_REDIS_URL;
const descreverIntegracao = bancoUrl && redisUrl ? describe : describe.skip;

descreverIntegracao('chat websocket', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(bancoUrl ?? '') });
  const redis = criarConexaoRedis(redisUrl ?? 'redis://127.0.0.1:56379', 'teste-chat');
  const tokens = new TokenTenantService('segredo-websocket-com-mais-de-32-caracteres', 900);
  const tenantA = '11111111-1111-4111-8111-111111111111';
  const tenantB = '22222222-2222-4222-8222-222222222222';
  const usuarioA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const usuarioB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const servidor = createServer(express());
  let gateway: ChatGateway;
  let porta = 0;
  let conversaId = '';

  beforeAll(async () => {
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
        nome: 'Socket',
        phone_number_id: 'phone-socket',
        waba_id: 'waba-socket',
        token_encrypted: 'token',
      },
    });
    const setor = await prisma.setor.create({
      data: { nome: 'Socket', nome_normalizado: 'socket' },
    });
    const usuario = await prisma.usuarioTenant.create({
      data: {
        usuario_central_public_id: usuarioA,
        nome: 'Socket A',
        nome_normalizado: 'socket a',
        email: 'a@socket.test',
        papel: 'ATENDENTE',
      },
    });
    const atendente = await prisma.atendente.create({
      data: { usuario_tenant_id: usuario.id, nome: usuario.nome, email: usuario.email },
    });
    await prisma.atendenteSetor.create({
      data: { atendente_id: atendente.id, setor_id: setor.id },
    });
    const contato = await prisma.contato.create({ data: { telefone: '+5511988888888' } });
    conversaId = (
      await prisma.conversa.create({
        data: {
          conta_whatsapp_id: conta.id,
          contato_id: contato.id,
          setor_id: setor.id,
          status: 'AGUARDANDO_ATENDENTE',
        },
      })
    ).public_id;
    gateway = new ChatGateway(
      servidor,
      redis,
      tokens,
      {
        buscarAtivoDoUsuario: (_email: string, tenantId: string) =>
          Promise.resolve({
            id: tenantId === tenantA ? 1 : 2,
            public_id: tenantId,
            string_conexao_encrypted: 'conexao',
          }),
      } as unknown as TenantCentralRepository,
      { descriptografar: () => 'postgresql://tenant' } as unknown as CriptografiaService,
      { obter: () => Promise.resolve(prisma) } as unknown as GerenciadorConexoesTenant,
      ['http://localhost:3001'],
    );
    await new Promise<void>((resolver) => servidor.listen(0, '127.0.0.1', resolver));
    const endereco = servidor.address();
    if (!endereco || typeof endereco === 'string') throw new Error('Servidor de teste sem porta');
    porta = endereco.port;
  });

  afterAll(async () => {
    await gateway.close();
    await new Promise<void>((resolver) =>
      servidor.close(() => {
        resolver();
      }),
    );
    redis.disconnect();
    await prisma.$disconnect();
  });

  function conectar(
    tenantId: string,
    usuarioId: string,
    email: string,
    papel: 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE' = 'ATENDENTE',
  ): Promise<Socket> {
    const token = tokens.emitir({
      publicId: usuarioId,
      tenantPublicId: tenantId,
      email,
      papel,
    });
    const socket = io(`http://127.0.0.1:${String(porta)}`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
    return new Promise((resolver, rejeitar) => {
      socket.once('connect', () => {
        resolver(socket);
      });
      socket.once('connect_error', rejeitar);
    });
  }

  it('isola eventos por tenant e autoriza room pelo setor', async () => {
    const [socketA, socketB, socketSemSetor] = await Promise.all([
      conectar(tenantA, usuarioA, 'a@socket.test'),
      conectar(tenantB, usuarioB, 'b@socket.test'),
      conectar(tenantA, usuarioB, 'sem-setor@socket.test'),
    ]);
    const entradaA = await new Promise<{ ok: boolean }>((resolver) =>
      socketA.emit('conversa:entrar', conversaId, resolver),
    );
    const entradaB = await new Promise<{ ok: boolean }>((resolver) =>
      socketB.emit('conversa:entrar', conversaId, resolver),
    );
    expect(entradaA.ok).toBe(true);
    expect(entradaB.ok).toBe(false);
    const recebidoA = new Promise<unknown>((resolver) =>
      socketA.once('conversa:atualizada', resolver),
    );
    let recebeuB = false;
    let recebeuSemSetor = false;
    socketB.once('conversa:atualizada', () => {
      recebeuB = true;
    });
    socketSemSetor.once('conversa:atualizada', () => {
      recebeuSemSetor = true;
    });
    barramentoChat.publicar('conversa:atualizada', {
      tenantId: tenantA,
      conversaId,
      dados: { status: 'BOT' },
    });
    await expect(recebidoA).resolves.toMatchObject({ tenantId: tenantA, conversaId });
    await new Promise((resolver) => setTimeout(resolver, 50));
    expect(recebeuB).toBe(false);
    expect(recebeuSemSetor).toBe(false);
    const segundaAba = await conectar(tenantA, usuarioA, 'a@socket.test');
    const socketIdEncerrado = socketA.id;
    const presencaRestante = new Promise<unknown>((resolver) => {
      segundaAba.on('atendente:presenca', (evento: unknown) => {
        if (
          typeof evento === 'object' &&
          evento !== null &&
          'online' in evento &&
          evento.online === true &&
          'socketId' in evento &&
          evento.socketId === socketIdEncerrado
        )
          resolver(evento);
      });
    });
    socketA.disconnect();
    await expect(presencaRestante).resolves.toMatchObject({ usuarioId: usuarioA, online: true });
    segundaAba.disconnect();
    socketB.disconnect();
    socketSemSetor.disconnect();
  });

  it('rejeita handshake sem JWT e mantém REST como recuperação após reconexão', async () => {
    const invalido = io(`http://127.0.0.1:${String(porta)}`, {
      transports: ['websocket'],
      forceNew: true,
    });
    await expect(
      new Promise<string>((resolver) =>
        invalido.once('connect_error', (erro) => {
          resolver(erro.message);
        }),
      ),
    ).resolves.toBe('NAO_AUTENTICADO');
    invalido.disconnect();
    const socket = await conectar(tenantA, usuarioA, 'a@socket.test');
    socket.disconnect();
    barramentoChat.publicar('conversa:mensagem_recebida', {
      tenantId: tenantA,
      conversaId,
      mensagemId: crypto.randomUUID(),
    });
    const reconectado = await conectar(tenantA, usuarioA, 'a@socket.test');
    expect(await prisma.conversa.count({ where: { public_id: conversaId } })).toBe(1);
    reconectado.disconnect();
  });
});

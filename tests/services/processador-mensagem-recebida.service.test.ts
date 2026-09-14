import '../configurar-ambiente.js';

import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { criarConexaoRedis } from '../../src/config/redis.js';
import { PrismaClient } from '../../src/generated/prisma-tenant/client.js';
import { EstadoFluxoRedisRepository } from '../../src/repositories/estado-fluxo-redis.repository.js';
import { ProcessadorMensagemRecebidaService } from '../../src/services/processador-mensagem-recebida.service.js';
import { MotorFluxoService } from '../../src/services/motor-fluxo.service.js';
import type { GerenciadorConexoesTenant } from '../../src/database/gerenciador-conexoes-tenant.js';
import type { TenantCentralRepository } from '../../src/repositories/tenant-central.repository.js';
import type { CriptografiaService } from '../../src/services/criptografia.service.js';

const url = process.env.TEST_TENANT_DATABASE_URL_B;
const urlRedis = process.env.TEST_REDIS_URL;
const descreverIntegracao = url && urlRedis ? describe : describe.skip;

descreverIntegracao('motor de fluxo conectado a mensagens recebidas', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(url ?? '') });
  const redis = criarConexaoRedis(
    urlRedis ?? 'redis://configuracao-ausente',
    'teste-mensagem-recebida',
  );
  const tenantId = 'aaaaaaaa-1111-4111-8111-111111111111';
  const enfileiradorSaida = { adicionar: vi.fn().mockResolvedValue(undefined) };

  function criarProcessador() {
    return new ProcessadorMensagemRecebidaService(
      {
        buscarPorPublicId: () =>
          Promise.resolve({ id: 1, status: 'ATIVO', string_conexao_encrypted: 'conexao' }),
      } as unknown as TenantCentralRepository,
      { descriptografar: () => 'postgresql://tenant' } as unknown as CriptografiaService,
      { obter: () => Promise.resolve(prisma) } as unknown as GerenciadorConexoesTenant,
      new EstadoFluxoRedisRepository(redis, 60),
      new MotorFluxoService(),
      enfileiradorSaida,
    );
  }

  async function criarFluxoPublicado(definicao: object) {
    const fluxo = await prisma.fluxo.create({
      data: { nome: `Fluxo ${crypto.randomUUID()}`, definicao, versao: 1, ativo: true },
    });
    await prisma.fluxoVersao.create({ data: { fluxo_id: fluxo.id, versao: 1, definicao } });
    return fluxo;
  }

  async function criarConta(fluxoId: number | null) {
    return prisma.contaWhatsapp.create({
      data: {
        nome: `Conta ${crypto.randomUUID()}`,
        instance_name: `instancia-${crypto.randomUUID()}`,
        api_key_encrypted: 'segredo',
        status: 'CONECTADO',
        fluxo_id: fluxoId,
      },
    });
  }

  beforeEach(async () => {
    enfileiradorSaida.adicionar.mockClear();
    await prisma.mensagem.deleteMany();
    await prisma.conversa.deleteMany();
    await prisma.contaWhatsapp.deleteMany();
    await prisma.fluxoVersao.deleteMany();
    await prisma.fluxo.deleteMany();
  });

  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  it('sem fluxo associado, apenas registra a mensagem recebida', async () => {
    const conta = await criarConta(null);
    const processador = criarProcessador();

    const resultado = await processador.processar({
      tenantId,
      instanceName: conta.instance_name,
      mensagemId: 'wamid.sem-fluxo',
      remetente: '5511999990001',
      timestamp: String(Math.floor(Date.now() / 1000)),
      tipo: 'text',
      texto: 'Oi',
    });

    expect(resultado).toBe('CRIADA');
    expect(enfileiradorSaida.adicionar).not.toHaveBeenCalled();
    const conversa = await prisma.conversa.findFirstOrThrow({
      where: { conta_whatsapp_id: conta.id },
    });
    expect(conversa.status).toBe('BOT');
    expect(await prisma.mensagem.count({ where: { conversa_id: conversa.id, autor: 'BOT' } })).toBe(
      0,
    );
  });

  it('com fluxo associado, executa o nó de mensagem e enfileira a resposta do bot', async () => {
    const fluxo = await criarFluxoPublicado({
      schemaVersao: 1,
      noInicial: 'boas-vindas',
      nos: [{ id: 'boas-vindas', tipo: 'mensagem', dados: { texto: 'Olá! Como posso ajudar?' } }],
    });
    const conta = await criarConta(fluxo.id);
    const processador = criarProcessador();

    const resultado = await processador.processar({
      tenantId,
      instanceName: conta.instance_name,
      mensagemId: 'wamid.com-fluxo',
      remetente: '5511999990002',
      timestamp: String(Math.floor(Date.now() / 1000)),
      tipo: 'text',
      texto: 'Oi',
    });

    expect(resultado).toBe('CRIADA');
    expect(enfileiradorSaida.adicionar).toHaveBeenCalledTimes(1);
    const [tenantChamado, mensagemPublicId] = enfileiradorSaida.adicionar.mock.calls[0] as [
      string,
      string,
    ];
    expect(tenantChamado).toBe(tenantId);

    const mensagemBot = await prisma.mensagem.findUniqueOrThrow({
      where: { public_id: mensagemPublicId },
    });
    expect(mensagemBot).toMatchObject({
      autor: 'BOT',
      direcao: 'SAIDA',
      status_entrega: 'PENDENTE',
      conteudo: { texto: 'Olá! Como posso ajudar?' },
    });
    const conversa = await prisma.conversa.findFirstOrThrow({
      where: { conta_whatsapp_id: conta.id },
    });
    expect(conversa.status).toBe('BOT');
  });

  it('depois de direcionado a um setor, novas mensagens não reacionam o fluxo', async () => {
    const setor = await prisma.setor.create({
      data: { nome: `Setor ${crypto.randomUUID()}`, nome_normalizado: 'setor-teste' },
    });
    const fluxo = await criarFluxoPublicado({
      schemaVersao: 1,
      noInicial: 'financeiro',
      nos: [{ id: 'financeiro', tipo: 'direcionar_setor', dados: { setorId: setor.public_id } }],
    });
    const conta = await criarConta(fluxo.id);
    const processador = criarProcessador();
    const remetente = '5511999990003';

    await processador.processar({
      tenantId,
      instanceName: conta.instance_name,
      mensagemId: 'wamid.direciona-1',
      remetente,
      timestamp: String(Math.floor(Date.now() / 1000)),
      tipo: 'text',
      texto: 'Preciso falar com o financeiro',
    });

    const conversaDirecionada = await prisma.conversa.findFirstOrThrow({
      where: { conta_whatsapp_id: conta.id },
    });
    expect(conversaDirecionada.status).toBe('AGUARDANDO_ATENDENTE');
    expect(conversaDirecionada.setor_id).toBe(setor.id);

    enfileiradorSaida.adicionar.mockClear();
    await processador.processar({
      tenantId,
      instanceName: conta.instance_name,
      mensagemId: 'wamid.direciona-2',
      remetente,
      timestamp: String(Math.floor(Date.now() / 1000) + 5),
      tipo: 'text',
      texto: 'Mais uma mensagem enquanto aguardo',
    });

    expect(enfileiradorSaida.adicionar).not.toHaveBeenCalled();
    const conversaFinal = await prisma.conversa.findFirstOrThrow({
      where: { conta_whatsapp_id: conta.id },
    });
    expect(conversaFinal.id).toBe(conversaDirecionada.id);
    expect(conversaFinal.status).toBe('AGUARDANDO_ATENDENTE');
    expect(
      await prisma.mensagem.count({ where: { conversa_id: conversaFinal.id, autor: 'CONTATO' } }),
    ).toBe(2);
    expect(
      await prisma.mensagem.count({ where: { conversa_id: conversaFinal.id, autor: 'BOT' } }),
    ).toBe(0);
  });
});

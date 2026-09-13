import './configurar-ambiente.js';

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { criarAplicacao } from '../src/app.js';
import { WebhookWhatsappController } from '../src/controllers/webhook-whatsapp.controller.js';
import type { WebhookEvolutionEntrada } from '../src/dtos/webhook-whatsapp.dto.js';
import type { GerenciadorConexoesTenant } from '../src/database/gerenciador-conexoes-tenant.js';
import type { EnfileiradorMensagem } from '../src/services/enfileirador-mensagem.service.js';
import type { CriptografiaService } from '../src/services/criptografia.service.js';
import { WebhookWhatsappService } from '../src/services/webhook-whatsapp.service.js';
import type { JobMensagemRecebida } from '../src/types/jobs.js';

interface ContaFixture {
  id: number;
  tenantId: number;
  tenantPublicId: string;
  instanceName: string;
  apiKey: string;
  status: 'CONECTANDO' | 'CONECTADO' | 'DESCONECTADO';
}

const contaA: ContaFixture = {
  id: 1,
  tenantId: 101,
  tenantPublicId: '11111111-1111-4111-8111-111111111111',
  instanceName: 'instancia-tenant-a',
  apiKey: 'apikey-tenant-a',
  status: 'CONECTANDO',
};
const contaB: ContaFixture = {
  id: 2,
  tenantId: 102,
  tenantPublicId: '22222222-2222-4222-8222-222222222222',
  instanceName: 'instancia-tenant-b',
  apiKey: 'apikey-tenant-b',
  status: 'CONECTANDO',
};
const contas = [contaA, contaB];

function corpoMensagem(
  instance: ContaFixture,
  apikeyInformada = instance.apiKey,
): WebhookEvolutionEntrada {
  return {
    event: 'messages.upsert',
    instance: instance.instanceName,
    apikey: apikeyInformada,
    data: {
      key: { id: 'wamid.mensagem-1', remoteJid: '5511888888888@s.whatsapp.net', fromMe: false },
      pushName: 'Cliente',
      messageTimestamp: 1_785_360_000,
      message: { conversation: 'Olá' },
    },
  };
}

describe('webhook do WhatsApp (Evolution API)', () => {
  const chaves = new Set<string>();
  const jobs: { dados: JobMensagemRecebida; chave: string }[] = [];
  const atualizacoesStatus: { id: number; status: string }[] = [];

  const idempotencia = {
    reservar: (chave: string) => Promise.resolve(chaves.size !== chaves.add(chave).size),
    liberar: (chave: string) => {
      chaves.delete(chave);
      return Promise.resolve();
    },
  };
  const enfileirador: EnfileiradorMensagem = {
    adicionar: (dados, chave) => {
      jobs.push({ dados, chave });
      return Promise.resolve();
    },
  };
  const roteamentos = {
    buscarTenantAtivo: (instanceName: string) => {
      const conta = contas.find((item) => item.instanceName === instanceName);
      if (!conta) return Promise.resolve(null);
      return Promise.resolve({
        tenant: {
          id: conta.tenantId,
          public_id: conta.tenantPublicId,
          status: 'ATIVO',
          string_conexao_encrypted: `conexao-${conta.instanceName}`,
          deletado_at: null,
        },
      });
    },
  };
  const prismaTenantFalso = {
    contaWhatsapp: {
      findFirst: (argumentos: { where: { instance_name: string } }) => {
        const conta = contas.find((item) => item.instanceName === argumentos.where.instance_name);
        if (!conta) return Promise.resolve(null);
        return Promise.resolve({
          id: conta.id,
          public_id: `conta-${String(conta.id)}`,
          instance_name: conta.instanceName,
          api_key_encrypted: conta.apiKey,
          status: conta.status,
        });
      },
      update: (argumentos: { where: { id: number }; data: { status: string } }) => {
        atualizacoesStatus.push({ id: argumentos.where.id, status: argumentos.data.status });
        return Promise.resolve({ id: argumentos.where.id, status: argumentos.data.status });
      },
    },
  };
  const conexoes = {
    obter: () => Promise.resolve(prismaTenantFalso),
  };
  const criptografiaIdentidade = { descriptografar: (valor: string) => valor };

  function criarServico(enfileiradorMensagem: EnfileiradorMensagem = enfileirador) {
    return new WebhookWhatsappService(
      roteamentos,
      conexoes as unknown as GerenciadorConexoesTenant,
      criptografiaIdentidade as unknown as CriptografiaService,
      criptografiaIdentidade as unknown as CriptografiaService,
      idempotencia,
      enfileiradorMensagem,
      60,
    );
  }

  const controller = new WebhookWhatsappController(criarServico());
  const aplicacao = criarAplicacao({ webhookWhatsapp: { controller } });

  beforeEach(() => {
    chaves.clear();
    jobs.length = 0;
    atualizacoesStatus.length = 0;
  });

  it('aceita evento válido, responde rápido e enfileira com o tenant correto', async () => {
    const inicio = performance.now();
    const resposta = await request(aplicacao)
      .post('/api/v1/webhook/whatsapp')
      .send(corpoMensagem(contaA));
    const duracaoMs = performance.now() - inicio;

    expect(resposta.status, JSON.stringify(resposta.body as unknown)).toBe(200);
    expect(duracaoMs).toBeLessThan(1_000);
    expect(resposta.body as unknown).toEqual({ processado: true, recebidas: 1, duplicadas: 0 });
    expect(jobs[0]).toMatchObject({
      dados: {
        tenantId: contaA.tenantPublicId,
        instanceName: contaA.instanceName,
        mensagemId: 'wamid.mensagem-1',
        texto: 'Olá',
      },
      chave: `tenant:${contaA.tenantPublicId}:webhook:mensagem:wamid.mensagem-1`,
    });
  });

  it('rejeita apikey que não confere com a instância antes de enfileirar', async () => {
    const resposta = await request(aplicacao)
      .post('/api/v1/webhook/whatsapp')
      .send(corpoMensagem(contaA, 'apikey-errada'));

    expect(resposta.status).toBe(403);
    expect(resposta.body as unknown).toMatchObject({ erro: { codigo: 'ACESSO_NEGADO' } });
    expect(jobs).toHaveLength(0);
  });

  it('não cria um segundo job para o mesmo evento', async () => {
    const enviar = () =>
      request(aplicacao).post('/api/v1/webhook/whatsapp').send(corpoMensagem(contaA));

    expect((await enviar()).body as unknown).toEqual({
      processado: true,
      recebidas: 1,
      duplicadas: 0,
    });
    expect((await enviar()).body as unknown).toEqual({
      processado: true,
      recebidas: 0,
      duplicadas: 1,
    });
    expect(jobs).toHaveLength(1);
  });

  it('isola a chave da mesma mensagem entre tenants', async () => {
    const servico = criarServico();
    await servico.receber(corpoMensagem(contaA));
    await servico.receber(corpoMensagem(contaB));

    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.chave).not.toBe(jobs[1]?.chave);
  });

  it('atualiza o status da conta em connection.update sem enfileirar mensagem', async () => {
    const servico = criarServico();
    const entrada: WebhookEvolutionEntrada = {
      event: 'connection.update',
      instance: contaA.instanceName,
      apikey: contaA.apiKey,
      data: { state: 'open' },
    };

    await expect(servico.receber(entrada)).resolves.toEqual({
      processado: true,
      recebidas: 0,
      duplicadas: 0,
    });
    expect(atualizacoesStatus).toEqual([{ id: contaA.id, status: 'CONECTADO' }]);
    expect(jobs).toHaveLength(0);
  });

  it('ignora eventos desconhecidos sem falhar', async () => {
    const servico = criarServico();
    const entrada: WebhookEvolutionEntrada = {
      event: 'presence.update',
      instance: contaA.instanceName,
      apikey: contaA.apiKey,
      data: {},
    };

    await expect(servico.receber(entrada)).resolves.toEqual({
      processado: false,
      recebidas: 0,
      duplicadas: 0,
    });
  });
});

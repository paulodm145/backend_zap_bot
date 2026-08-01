import './configurar-ambiente.js';

import { createHmac } from 'node:crypto';

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { criarAplicacao } from '../src/app.js';
import { WebhookWhatsappController } from '../src/controllers/webhook-whatsapp.controller.js';
import type { WebhookWhatsappEntrada } from '../src/dtos/webhook-whatsapp.dto.js';
import type { EnfileiradorMensagem } from '../src/services/enfileirador-mensagem.service.js';
import { WebhookWhatsappService } from '../src/services/webhook-whatsapp.service.js';
import type { JobMensagemRecebida } from '../src/types/jobs.js';

const appSecret = process.env.WEBHOOK_WHATSAPP_APP_SECRET ?? '';
const verifyToken = process.env.WEBHOOK_WHATSAPP_VERIFY_TOKEN ?? '';

const corpo: WebhookWhatsappEntrada = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'waba-1',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '5511999999999',
              phone_number_id: 'numero-tenant-a',
            },
            messages: [
              {
                id: 'wamid.mensagem-1',
                from: '5511888888888',
                timestamp: '1785360000',
                type: 'text',
                text: { body: 'Olá' },
              },
            ],
          },
        },
      ],
    },
  ],
};

function assinatura(payload: string): string {
  return `sha256=${createHmac('sha256', appSecret).update(payload).digest('hex')}`;
}

describe('webhook do WhatsApp', () => {
  const chaves = new Set<string>();
  const jobs: { dados: JobMensagemRecebida; chave: string }[] = [];
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
    buscarTenantAtivo: (phoneNumberId: string) =>
      Promise.resolve({
        tenant: {
          public_id:
            phoneNumberId === 'numero-tenant-a'
              ? '11111111-1111-4111-8111-111111111111'
              : '22222222-2222-4222-8222-222222222222',
          status: 'ATIVO',
          deletado_at: null,
        },
      }),
  };
  const controller = new WebhookWhatsappController(
    new WebhookWhatsappService(roteamentos, idempotencia, enfileirador, 60),
    verifyToken,
  );
  const aplicacao = criarAplicacao({
    webhookWhatsapp: { controller, appSecret },
  });

  beforeEach(() => {
    chaves.clear();
    jobs.length = 0;
  });

  it('responde o challenge quando o token de verificação confere', async () => {
    const resposta = await request(aplicacao).get('/api/v1/webhook/whatsapp').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': verifyToken,
      'hub.challenge': 'desafio-123',
    });

    expect(resposta.status).toBe(200);
    expect(resposta.text).toBe('desafio-123');
  });

  it('aceita assinatura válida, preserva o corpo bruto e enfileira com tenant', async () => {
    const payload = JSON.stringify(corpo);
    const inicio = performance.now();
    const resposta = await request(aplicacao)
      .post('/api/v1/webhook/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', assinatura(payload))
      .send(payload);
    const duracaoMs = performance.now() - inicio;

    expect(resposta.status, JSON.stringify(resposta.body as unknown)).toBe(200);
    expect(duracaoMs).toBeLessThan(1_000);
    expect(resposta.body as unknown).toEqual({ recebidas: 1, duplicadas: 0 });
    expect(jobs[0]).toMatchObject({
      dados: {
        tenantId: '11111111-1111-4111-8111-111111111111',
        mensagemId: 'wamid.mensagem-1',
        texto: 'Olá',
      },
      chave: 'tenant:11111111-1111-4111-8111-111111111111:webhook:mensagem:wamid.mensagem-1',
    });
  });

  it('rejeita assinatura inválida antes de enfileirar', async () => {
    const resposta = await request(aplicacao)
      .post('/api/v1/webhook/whatsapp')
      .set('X-Hub-Signature-256', 'sha256=incorreta')
      .send(corpo);

    expect(resposta.status).toBe(403);
    expect(resposta.body as unknown).toMatchObject({
      erro: { codigo: 'ACESSO_NEGADO' },
    });
    expect(jobs).toHaveLength(0);
  });

  it('não cria um segundo job para o mesmo evento', async () => {
    const payload = JSON.stringify(corpo);
    const enviar = () =>
      request(aplicacao)
        .post('/api/v1/webhook/whatsapp')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', assinatura(payload))
        .send(payload);

    expect((await enviar()).body as unknown).toEqual({ recebidas: 1, duplicadas: 0 });
    expect((await enviar()).body as unknown).toEqual({ recebidas: 0, duplicadas: 1 });
    expect(jobs).toHaveLength(1);
  });

  it('isola a chave da mesma mensagem entre tenants', async () => {
    const servico = new WebhookWhatsappService(roteamentos, idempotencia, enfileirador, 60);
    await servico.receber(corpo);
    const corpoTenantB = structuredClone(corpo);
    const alteracao = corpoTenantB.entry.at(0)?.changes.at(0);
    if (!alteracao) throw new Error('Fixture do webhook sem alteração');
    alteracao.value.metadata.phone_number_id = 'numero-tenant-b';
    await servico.receber(corpoTenantB);

    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.chave).not.toBe(jobs[1]?.chave);
  });

  it('enfileira atualizações de entrega sem criar mensagem recebida', async () => {
    const statusEnfileirados: unknown[] = [];
    const servico = new WebhookWhatsappService(roteamentos, idempotencia, enfileirador, 60, {
      adicionar: (dados) => {
        statusEnfileirados.push(dados);
        return Promise.resolve();
      },
    });
    const entrada: WebhookWhatsappEntrada = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: 'numero-tenant-a' },
                statuses: [{ id: 'wamid.saida', status: 'delivered', timestamp: '1785360000' }],
              },
            },
          ],
        },
      ],
    };
    await expect(servico.receber(entrada)).resolves.toEqual({
      recebidas: 0,
      duplicadas: 0,
      statusRecebidos: 1,
    });
    expect(statusEnfileirados).toEqual([
      expect.objectContaining({ mensagemId: 'wamid.saida', status: 'delivered' }),
    ]);
  });
});

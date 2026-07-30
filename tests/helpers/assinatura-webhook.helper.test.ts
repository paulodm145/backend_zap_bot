import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { assinaturaWebhookValida } from '../../src/helpers/assinatura-webhook.helper.js';

describe('assinatura do webhook', () => {
  it('compara HMAC SHA-256 sem aceitar formato inválido', () => {
    const corpo = Buffer.from('{"evento":"mensagem"}');
    const segredo = 'segredo-de-teste';
    const assinatura = `sha256=${createHmac('sha256', segredo).update(corpo).digest('hex')}`;

    expect(assinaturaWebhookValida(corpo, assinatura, segredo)).toBe(true);
    expect(assinaturaWebhookValida(corpo, 'sha256=invalida', segredo)).toBe(false);
    expect(assinaturaWebhookValida(corpo, assinatura.replace('sha256=', ''), segredo)).toBe(false);
  });
});

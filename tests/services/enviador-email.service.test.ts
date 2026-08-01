import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EnviadorEmailLocal,
  EnviadorEmailResend,
} from '../../src/services/enviador-email.service.js';

const mensagem = { destinatario: 'pessoa@tenant.com', assunto: 'Assunto', texto: 'Conteúdo' };

describe('enviadores de e-mail', () => {
  afterEach(() => vi.restoreAllMocks());

  it('suprime envio no modo local', async () => {
    await expect(new EnviadorEmailLocal().enviar(mensagem)).resolves.toBeUndefined();
  });

  it('envia pelo Resend sem expor configuração', async () => {
    const requisicao = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 202 }));
    await new EnviadorEmailResend('segredo', 'remetente@tenant.com').enviar(mensagem);
    expect(requisicao).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('propaga falha do provedor', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
    await expect(
      new EnviadorEmailResend('segredo', 'remetente@tenant.com').enviar(mensagem),
    ).rejects.toThrow('Falha ao enviar e-mail de recuperação');
  });
});

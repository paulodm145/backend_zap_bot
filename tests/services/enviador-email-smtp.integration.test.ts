import '../configurar-ambiente.js';
import { createServer, type Server } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EnviadorEmailSmtp } from '../../src/services/enviador-email.service.js';

describe('enviador SMTP', () => {
  let servidor: Server;
  let porta = 0;
  let mensagemRecebida = '';

  beforeAll(async () => {
    servidor = createServer((socket) => {
      let buffer = '';
      let recebendoDados = false;
      socket.write('220 smtp-teste ESMTP\r\n');
      socket.on('data', (dados) => {
        buffer += dados.toString('utf8');
        if (recebendoDados) {
          const fim = buffer.indexOf('\r\n.\r\n');
          if (fim >= 0) {
            mensagemRecebida = buffer.slice(0, fim);
            buffer = buffer.slice(fim + 5);
            recebendoDados = false;
            socket.write('250 mensagem aceita\r\n');
          }
          return;
        }
        let quebra = buffer.indexOf('\r\n');
        while (quebra >= 0) {
          const linha = buffer.slice(0, quebra);
          buffer = buffer.slice(quebra + 2);
          if (/^(EHLO|HELO) /i.test(linha)) socket.write('250-smtp-teste\r\n250 OK\r\n');
          else if (/^(MAIL FROM|RCPT TO):/i.test(linha)) socket.write('250 OK\r\n');
          else if (/^DATA$/i.test(linha)) {
            recebendoDados = true;
            socket.write('354 finalize com ponto\r\n');
            break;
          } else if (/^QUIT$/i.test(linha)) socket.end('221 encerrando\r\n');
          quebra = buffer.indexOf('\r\n');
        }
      });
    });
    await new Promise<void>((resolver) => servidor.listen(0, '127.0.0.1', resolver));
    const endereco = servidor.address();
    if (!endereco || typeof endereco === 'string') throw new Error('Servidor SMTP sem porta');
    porta = endereco.port;
  });

  afterAll(
    async () =>
      new Promise<void>((resolver) =>
        servidor.close(() => {
          resolver();
        }),
      ),
  );

  it('entrega mensagem multipart ao servidor SMTP', async () => {
    await new EnviadorEmailSmtp({
      host: '127.0.0.1',
      porta,
      seguro: false,
      remetente: 'nao-responda@localhost.test',
    }).enviar({
      destinatario: 'pessoa@tenant.test',
      assunto: 'Recuperação de senha',
      texto: 'Acesse o link de recuperação',
      html: '<p>Acesse o link de recuperação</p>',
    });
    expect(mensagemRecebida).toContain('Subject:');
    expect(mensagemRecebida).toContain('pessoa@tenant.test');
    expect(mensagemRecebida).toContain('multipart/alternative');
  });
});

const descreverSmtpLocal = process.env.TEST_SMTP_HOST ? describe : describe.skip;

descreverSmtpLocal('servidor SMTP local', () => {
  it('entrega uma mensagem ao MailHog ou servidor compatível', async () => {
    await new EnviadorEmailSmtp({
      host: process.env.TEST_SMTP_HOST ?? '127.0.0.1',
      porta: Number(process.env.TEST_SMTP_PORTA ?? '1025'),
      seguro: false,
      remetente: 'nao-responda@localhost.test',
    }).enviar({
      destinatario: 'teste-recuperacao@localhost.test',
      assunto: 'Teste da fila de recuperação',
      texto: 'Entrega SMTP local validada.',
    });
  });
});

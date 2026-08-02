import '../configurar-ambiente.js';
import { describe, expect, it } from 'vitest';
import type { Queue } from 'bullmq';
import {
  EnfileiradorEmailBullMqService,
  EnfileiradorEmailLocal,
} from '../../src/services/enfileirador-email.service.js';
import {
  EnviadorEmailLocal,
  EnviadorEmailResend,
  EnviadorEmailSmtp,
  type EnviadorEmail,
  type MensagemEmail,
} from '../../src/services/enviador-email.service.js';
import { criarEnviadorEmail } from '../../src/services/fabrica-enviador-email.service.js';
import { ProcessadorEmailService } from '../../src/services/processador-email.service.js';
import { TemplateEmailService } from '../../src/services/template-email.service.js';
import type { JobEmail } from '../../src/types/jobs.js';

const job: JobEmail = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  tipo: 'RECUPERACAO_SENHA',
  destinatario: 'pessoa@tenant.test',
  dados: {
    nome: 'Pessoa <Teste>',
    urlRedefinicao: 'http://localhost:3001/redefinir-senha?token=segredo',
    expiracaoMinutos: 30,
  },
};

describe('e-mail transacional', () => {
  it('renderiza texto e HTML seguros para recuperação de senha', () => {
    const mensagem = new TemplateEmailService().renderizar(job);
    expect(mensagem.texto).toContain(job.dados.urlRedefinicao);
    expect(mensagem.html).toContain('Pessoa &lt;Teste&gt;');
    expect(mensagem.html).not.toContain('Pessoa <Teste>');
  });

  it('processa o job usando o provedor configurado', async () => {
    const mensagens: MensagemEmail[] = [];
    const enviador: EnviadorEmail = {
      enviar: (mensagem) => {
        mensagens.push(mensagem);
        return Promise.resolve();
      },
    };
    await new ProcessadorEmailService(new TemplateEmailService(), enviador).processar(job);
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0]).toMatchObject({
      destinatario: 'pessoa@tenant.test',
      assunto: 'Recuperação de senha',
    });
  });

  it('adiciona cada solicitação como job independente na fila', async () => {
    const chamadas: unknown[][] = [];
    const fila = {
      add: (...argumentos: unknown[]) => {
        chamadas.push(argumentos);
        return Promise.resolve();
      },
    } as unknown as Queue<JobEmail>;
    await new EnfileiradorEmailBullMqService(fila).adicionar(job);
    expect(chamadas[0]?.[0]).toBe('enviar-email-transacional');
    expect(chamadas[0]?.[1]).toBe(job);
    const opcoes = chamadas[0]?.[2];
    expect(typeof opcoes).toBe('object');
    expect(opcoes).not.toBeNull();
    if (typeof opcoes !== 'object' || opcoes === null || !('jobId' in opcoes))
      throw new Error('Opções do job ausentes');
    expect(typeof opcoes.jobId).toBe('string');
  });

  it('permite suprimir a entrega mantendo o mesmo contrato de fila', async () => {
    await expect(new EnfileiradorEmailLocal().adicionar(job)).resolves.toBeUndefined();
  });

  it('seleciona os provedores local, SMTP e Resend pela configuração', () => {
    const base = {
      EMAIL_REMETENTE: 'nao-responda@localhost.test',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORTA: 1025,
      SMTP_SEGURO: false,
      SMTP_USUARIO: undefined,
      SMTP_SENHA: undefined,
      RESEND_API_KEY: undefined,
    };
    expect(criarEnviadorEmail({ ...base, EMAIL_PROVEDOR: 'local' })).toBeInstanceOf(
      EnviadorEmailLocal,
    );
    expect(
      criarEnviadorEmail({
        ...base,
        EMAIL_PROVEDOR: 'smtp',
        SMTP_USUARIO: 'usuario',
        SMTP_SENHA: 'senha',
      }),
    ).toBeInstanceOf(EnviadorEmailSmtp);
    expect(
      criarEnviadorEmail({ ...base, EMAIL_PROVEDOR: 'resend', RESEND_API_KEY: 'chave' }),
    ).toBeInstanceOf(EnviadorEmailResend);
  });
});

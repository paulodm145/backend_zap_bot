import type { JobEmail } from '../types/jobs.js';
import type { MensagemEmail } from './enviador-email.service.js';

function escaparHtml(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export class TemplateEmailService {
  public renderizar(job: JobEmail): MensagemEmail {
    const nome = job.dados.nome;
    const url = job.dados.urlRedefinicao;
    const minutos = job.dados.expiracaoMinutos;
    return {
      destinatario: job.destinatario,
      assunto: 'Recuperação de senha',
      texto: [
        `Olá, ${nome}.`,
        '',
        'Recebemos uma solicitação para redefinir sua senha.',
        `Acesse ${url}`,
        `Este link expira em ${String(minutos)} minutos.`,
        '',
        'Se você não fez essa solicitação, ignore esta mensagem.',
      ].join('\n'),
      html: `<p>Olá, ${escaparHtml(nome)}.</p><p>Recebemos uma solicitação para redefinir sua senha.</p><p><a href="${escaparHtml(url)}">Redefinir minha senha</a></p><p>Este link expira em ${String(minutos)} minutos.</p><p>Se você não fez essa solicitação, ignore esta mensagem.</p>`,
    };
  }
}

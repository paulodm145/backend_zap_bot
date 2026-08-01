import { logger } from '../config/logger.js';

export interface MensagemEmail {
  destinatario: string;
  assunto: string;
  texto: string;
}

export interface EnviadorEmail {
  enviar(mensagem: MensagemEmail): Promise<void>;
}

export class EnviadorEmailLocal implements EnviadorEmail {
  public enviar(mensagem: MensagemEmail): Promise<void> {
    logger.info(
      { destinatario: mensagem.destinatario, assunto: mensagem.assunto },
      'E-mail suprimido pelo provedor local',
    );
    return Promise.resolve();
  }
}

export class EnviadorEmailResend implements EnviadorEmail {
  public constructor(
    private readonly apiKey: string,
    private readonly remetente: string,
  ) {}

  public async enviar(mensagem: MensagemEmail): Promise<void> {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.remetente,
        to: [mensagem.destinatario],
        subject: mensagem.assunto,
        text: mensagem.texto,
      }),
    });
    if (!resposta.ok) throw new Error('Falha ao enviar e-mail de recuperação');
  }
}

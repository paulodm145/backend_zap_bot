import type { ambiente } from '../config/ambiente.js';
import {
  EnviadorEmailLocal,
  EnviadorEmailResend,
  EnviadorEmailSmtp,
  type EnviadorEmail,
} from './enviador-email.service.js';

type AmbienteEmail = Pick<
  typeof ambiente,
  | 'EMAIL_PROVEDOR'
  | 'EMAIL_REMETENTE'
  | 'RESEND_API_KEY'
  | 'SMTP_HOST'
  | 'SMTP_PORTA'
  | 'SMTP_SEGURO'
  | 'SMTP_USUARIO'
  | 'SMTP_SENHA'
>;

export function criarEnviadorEmail(configuracao: AmbienteEmail): EnviadorEmail {
  if (configuracao.EMAIL_PROVEDOR === 'resend')
    return new EnviadorEmailResend(configuracao.RESEND_API_KEY ?? '', configuracao.EMAIL_REMETENTE);
  if (configuracao.EMAIL_PROVEDOR === 'smtp')
    return new EnviadorEmailSmtp({
      host: configuracao.SMTP_HOST,
      porta: configuracao.SMTP_PORTA,
      seguro: configuracao.SMTP_SEGURO,
      remetente: configuracao.EMAIL_REMETENTE,
      ...(configuracao.SMTP_USUARIO ? { usuario: configuracao.SMTP_USUARIO } : {}),
      ...(configuracao.SMTP_SENHA ? { senha: configuracao.SMTP_SENHA } : {}),
    });
  return new EnviadorEmailLocal();
}

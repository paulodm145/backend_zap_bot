import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSAO_ATUAL = 'v1';

export function criptografarPayload(valor: string, chave: Buffer): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv('aes-256-gcm', chave, iv);
  const cifrado = Buffer.concat([cifrador.update(valor, 'utf8'), cifrador.final()]);
  return [VERSAO_ATUAL, iv, cifrador.getAuthTag(), cifrado]
    .map((item) => (typeof item === 'string' ? item : item.toString('base64url')))
    .join('.');
}

export function descriptografarPayload(payload: string, chave: Buffer): string {
  const [versao, ivTexto, tagTexto, cifradoTexto] = payload.split('.');
  if (versao !== VERSAO_ATUAL || !ivTexto || !tagTexto || !cifradoTexto) {
    throw new Error('Payload criptografado inválido ou incompatível');
  }
  const decifrador = createDecipheriv('aes-256-gcm', chave, Buffer.from(ivTexto, 'base64url'));
  decifrador.setAuthTag(Buffer.from(tagTexto, 'base64url'));
  return Buffer.concat([
    decifrador.update(Buffer.from(cifradoTexto, 'base64url')),
    decifrador.final(),
  ]).toString('utf8');
}

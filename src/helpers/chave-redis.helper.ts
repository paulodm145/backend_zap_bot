import { createHash } from 'node:crypto';

export function criarChaveIdempotenciaMensagem(tenantId: string, mensagemId: string): string {
  return `tenant:${tenantId}:webhook:mensagem:${mensagemId}`;
}

export function criarJobId(chaveIdempotencia: string): string {
  return createHash('sha256').update(chaveIdempotencia).digest('hex');
}

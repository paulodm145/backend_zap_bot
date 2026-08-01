import { EventEmitter } from 'node:events';

export const EVENTOS_CHAT = [
  'conversa:nova_na_fila',
  'conversa:assumida',
  'conversa:atualizada',
  'conversa:mensagem_recebida',
  'conversa:mensagem_atualizada',
] as const;
export type NomeEventoChat = (typeof EVENTOS_CHAT)[number];

export interface EventoChat {
  tenantId: string;
  conversaId: string;
  setorId?: string;
  mensagemId?: string;
  dados?: unknown;
}

class BarramentoChat extends EventEmitter {
  public publicar(nome: NomeEventoChat, evento: EventoChat): void {
    this.emit(nome, evento);
  }
}

export const barramentoChat = new BarramentoChat();

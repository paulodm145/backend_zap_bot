import type { Redis } from 'ioredis';

import { estadoConversaFluxoSchema, type EstadoConversaFluxo } from '../dtos/fluxo.dto.js';

export interface EstadoFluxoRepository {
  carregar(tenantId: string, conversaId: string): Promise<EstadoConversaFluxo | null>;
  salvar(tenantId: string, conversaId: string, estado: EstadoConversaFluxo): Promise<void>;
}

export function criarChaveEstadoFluxo(tenantId: string, conversaId: string): string {
  return `tenant:${tenantId}:conversa:${conversaId}:estado`;
}

export class EstadoFluxoRedisRepository implements EstadoFluxoRepository {
  public constructor(
    private readonly redis: Redis,
    private readonly expiracaoSegundos = 30 * 24 * 60 * 60,
  ) {}

  public async carregar(tenantId: string, conversaId: string): Promise<EstadoConversaFluxo | null> {
    const valor = await this.redis.get(criarChaveEstadoFluxo(tenantId, conversaId));
    return valor ? estadoConversaFluxoSchema.parse(JSON.parse(valor) as unknown) : null;
  }

  public async salvar(
    tenantId: string,
    conversaId: string,
    estado: EstadoConversaFluxo,
  ): Promise<void> {
    await this.redis.set(
      criarChaveEstadoFluxo(tenantId, conversaId),
      JSON.stringify(estado),
      'EX',
      this.expiracaoSegundos,
    );
  }
}

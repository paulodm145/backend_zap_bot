import type { Redis } from 'ioredis';

export class IdempotenciaRedisRepository {
  public constructor(private readonly redis: Redis) {}

  public async reservar(chave: string, expiracaoSegundos: number): Promise<boolean> {
    const resultado = await this.redis.set(chave, '1', 'EX', expiracaoSegundos, 'NX');
    return resultado === 'OK';
  }

  public async liberar(chave: string): Promise<void> {
    await this.redis.del(chave);
  }
}

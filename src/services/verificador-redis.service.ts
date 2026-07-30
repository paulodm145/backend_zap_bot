import type { Redis } from 'ioredis';

import type { VerificadorDependencia } from './prontidao.service.js';

export class VerificadorRedisService implements VerificadorDependencia {
  public readonly nome = 'redis';

  public constructor(private readonly redis: Redis) {}

  public async verificar(): Promise<void> {
    await this.redis.ping();
  }
}

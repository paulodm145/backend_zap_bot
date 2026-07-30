import { Redis } from 'ioredis';

export function criarConexaoRedis(url: string, nome: string): Redis {
  return new Redis(url, {
    connectionName: nome,
    enableReadyCheck: true,
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
}

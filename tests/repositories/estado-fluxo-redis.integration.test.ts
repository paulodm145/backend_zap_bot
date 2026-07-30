import '../configurar-ambiente.js';

import { afterAll, describe, expect, it } from 'vitest';

import { criarConexaoRedis } from '../../src/config/redis.js';
import type { EstadoConversaFluxo } from '../../src/dtos/fluxo.dto.js';
import {
  criarChaveEstadoFluxo,
  EstadoFluxoRedisRepository,
} from '../../src/repositories/estado-fluxo-redis.repository.js';

const urlTeste = process.env.TEST_REDIS_URL;
const descreverIntegracao = urlTeste ? describe : describe.skip;
const redis = criarConexaoRedis(urlTeste ?? 'redis://configuracao-ausente', 'teste-estado-fluxo');

descreverIntegracao('persistência do estado de fluxo no Redis', () => {
  afterAll(async () => {
    await redis.quit();
  });

  it('salva e carrega o snapshot isolado por tenant e conversa', async () => {
    const repository = new EstadoFluxoRedisRepository(redis, 60);
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const conversaId = 'conversa-estado-fluxo';
    const estado: EstadoConversaFluxo = {
      fluxoVersaoId: '33333333-3333-4333-8333-333333333333',
      noAtualId: 'captura',
      variaveis: { origem: 'teste' },
      aguardandoCaptura: {
        noId: 'captura',
        variavel: 'cliente.nome',
      },
      concluido: false,
      passosExecutados: 2,
    };

    await repository.salvar(tenantId, conversaId, estado);

    await expect(repository.carregar(tenantId, conversaId)).resolves.toEqual(estado);
    await expect(repository.carregar('outro-tenant', conversaId)).resolves.toBeNull();

    await redis.del(criarChaveEstadoFluxo(tenantId, conversaId));
  });
});

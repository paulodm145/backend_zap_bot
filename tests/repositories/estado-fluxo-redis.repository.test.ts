import { describe, expect, it } from 'vitest';

import { criarChaveEstadoFluxo } from '../../src/repositories/estado-fluxo-redis.repository.js';

describe('estado Redis do fluxo', () => {
  it('inclui tenant e conversa no namespace', () => {
    expect(criarChaveEstadoFluxo('tenant-a', 'conversa-1')).toBe(
      'tenant:tenant-a:conversa:conversa-1:estado',
    );
    expect(criarChaveEstadoFluxo('tenant-a', 'conversa-1')).not.toBe(
      criarChaveEstadoFluxo('tenant-b', 'conversa-1'),
    );
  });
});

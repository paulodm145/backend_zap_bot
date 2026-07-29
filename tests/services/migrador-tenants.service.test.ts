import { describe, expect, it, vi } from 'vitest';

import {
  MigradorTenantsService,
  type TenantParaMigracao,
} from '../../src/services/migrador-tenants.service.js';

const tenants: TenantParaMigracao[] = [
  { id: 1, publicId: 'tenant-a', stringConexaoCriptografada: 'a' },
  { id: 2, publicId: 'tenant-b', stringConexaoCriptografada: 'b' },
  { id: 3, publicId: 'tenant-c', stringConexaoCriptografada: 'c' },
];

describe('MigradorTenantsService', () => {
  it('continua após falha isolada e retorna resumo', async () => {
    const executar = vi.fn((tenant: TenantParaMigracao) => {
      return tenant.id === 2 ? Promise.reject(new Error('Banco indisponível')) : Promise.resolve();
    });
    const resumo = await new MigradorTenantsService(executar).migrar(tenants);
    expect(executar).toHaveBeenCalledTimes(3);
    expect(resumo).toMatchObject({ total: 3, sucessos: 2, falhas: 1 });
    expect(resumo.resultados[1]).toEqual({
      tenantId: 'tenant-b',
      sucesso: false,
      erro: 'Banco indisponível',
    });
  });
});

import '../configurar-ambiente.js';

import { describe, expect, it } from 'vitest';

import { TokenInternoService } from '../../src/services/token-interno.service.js';
import { TokenTenantService } from '../../src/services/token-tenant.service.js';

describe('TokenTenantService', () => {
  const segredo = 'segredo-compartilhado-apenas-neste-teste-completo';
  const tenant = new TokenTenantService(segredo, 900);
  const interno = new TokenInternoService({
    segredo,
    expiracaoSegundos: 900,
  });

  it('emite e valida as claims de tenant', () => {
    const payload = tenant.verificar(
      tenant.emitir({
        publicId: '72f810fd-7355-4653-9ca7-d8b46f75450e',
        tenantPublicId: 'c480f80d-15f4-490a-9304-091da5f77e31',
        email: 'usuario@empresa.com',
      }),
    );
    expect(payload.tipo).toBe('tenant');
    expect(payload.tenantId).toBe('c480f80d-15f4-490a-9304-091da5f77e31');
  });

  it('não aceita token interno nas rotas de tenant', () => {
    const tokenInterno = interno.emitir({
      id: '72f810fd-7355-4653-9ca7-d8b46f75450e',
      email: 'admin@zapbot.com',
      papel: 'super_admin',
    });
    expect(() => tenant.verificar(tokenInterno)).toThrow('Access token inválido ou expirado');
  });

  it('não aceita token de tenant nas rotas internas', () => {
    const tokenTenant = tenant.emitir({
      publicId: '72f810fd-7355-4653-9ca7-d8b46f75450e',
      tenantPublicId: 'c480f80d-15f4-490a-9304-091da5f77e31',
      email: 'usuario@empresa.com',
    });
    expect(() => interno.verificar(tokenTenant)).toThrow();
  });
});

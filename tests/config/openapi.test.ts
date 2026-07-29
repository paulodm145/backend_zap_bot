import '../configurar-ambiente.js';

import { describe, expect, it } from 'vitest';

import { gerarDocumentoOpenApi } from '../../src/config/openapi.js';

describe('OpenAPI', () => {
  it('gera um documento OpenAPI 3 com as rotas existentes', () => {
    const documento = gerarDocumentoOpenApi();

    expect(documento.openapi).toBe('3.0.3');
    expect(documento.paths).toHaveProperty('/api/v1/saude');
    expect(documento.paths).toHaveProperty('/api/v1/prontidao');
    expect(documento.paths).toHaveProperty('/api/v1/interno/auth/login');
    expect(documento.paths).toHaveProperty('/api/v1/interno/saude');
    expect(documento.paths).toHaveProperty('/api/v1/interno/tenants');
    expect(documento.paths).toHaveProperty('/api/v1/interno/tenants/{tenantId}');
    expect(documento.paths).toHaveProperty('/api/v1/interno/tenants/{tenantId}/status');
    expect(documento.paths).toHaveProperty('/api/v1/interno/tenants/{tenantId}/plano');
    expect(documento.paths).toHaveProperty('/api/v1/openapi.json');
    expect(documento.paths).toHaveProperty('/api/v1/docs');
  });

  it('registra autenticação Bearer e schemas sem nomes duplicados', () => {
    const documento = gerarDocumentoOpenApi();
    const schemas = documento.components?.schemas ?? {};
    const nomes = Object.keys(schemas);

    expect(documento.components?.securitySchemes).toHaveProperty('bearerAuth');
    expect(nomes).toContain('ErroResposta');
    expect(nomes).toContain('PaginacaoResposta');
    expect(new Set(nomes).size).toBe(nomes.length);
  });
});

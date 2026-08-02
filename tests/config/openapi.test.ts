import '../configurar-ambiente.js';

import { describe, expect, it } from 'vitest';

import { gerarDocumentoOpenApi } from '../../src/config/openapi.js';

function objeto(valor: unknown): Record<string, unknown> | undefined {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : undefined;
}

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
    expect(documento.paths).toHaveProperty('/api/v1/webhook/whatsapp');
    expect(documento.paths).toHaveProperty('/api/v1/conversas/{conversaId}/mensagens');
    expect(documento.paths).toHaveProperty('/api/v1/fluxos');
    expect(documento.paths).toHaveProperty('/api/v1/fluxos/{fluxoId}');
    expect(documento.paths).toHaveProperty('/api/v1/fluxos/{fluxoId}/publicar');
    expect(documento.paths).toHaveProperty('/api/v1/fluxos/{fluxoId}/simular');
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

  it('documenta schema em toda resposta 2xx com corpo e preserva 204 sem corpo', () => {
    const documento = objeto(JSON.parse(JSON.stringify(gerarDocumentoOpenApi())) as unknown);
    const paths = objeto(documento?.paths);
    const metodos = new Set(['get', 'post', 'put', 'patch', 'delete']);

    expect(paths).toBeDefined();
    for (const [path, item] of Object.entries(paths ?? {})) {
      for (const [metodo, operacao] of Object.entries(objeto(item) ?? {})) {
        if (!metodos.has(metodo)) continue;
        const respostas = objeto(objeto(operacao)?.responses);
        if (!respostas) continue;
        for (const [status, resposta] of Object.entries(respostas)) {
          if (!/^2\d\d$/.test(status)) continue;
          const content = objeto(objeto(resposta)?.content);
          if (status === '204') {
            expect(
              content,
              `${metodo.toUpperCase()} ${path} 204 não deve possuir corpo`,
            ).toBeUndefined();
            continue;
          }
          expect(content, `${metodo.toUpperCase()} ${path} ${status} sem content`).toBeDefined();
          for (const [tipo, midia] of Object.entries(content ?? {})) {
            expect(
              objeto(midia)?.schema,
              `${metodo.toUpperCase()} ${path} ${status} ${tipo} sem schema`,
            ).toBeDefined();
          }
        }
      }
    }
  });
});

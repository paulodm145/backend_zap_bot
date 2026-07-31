import '../configurar-ambiente.js';

import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { gerarDocumentoOpenApi } from '../../src/config/openapi.js';

describe('documentação Markdown dos endpoints', () => {
  it('referencia todos os paths publicados no OpenAPI', async () => {
    const referencia = await readFile('docs/api/REFERENCIA-ENDPOINTS.md', 'utf8');
    const paths = Object.keys(gerarDocumentoOpenApi().paths);

    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(referencia, `Endpoint ausente na referência: ${path}`).toContain(path);
    }
  });
});

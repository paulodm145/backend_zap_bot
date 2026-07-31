import { describe, expect, it } from 'vitest';

import { normalizarTextoBusca } from '../../src/helpers/texto.helper.js';

describe('normalização de texto para busca', () => {
  it('remove acentos, caixa e espaços excedentes', () => {
    expect(normalizarTextoBusca('  São   José  ')).toBe('sao jose');
  });
});

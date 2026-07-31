import { describe, expect, it } from 'vitest';

import { normalizarCep, normalizarCnpj } from '../../src/helpers/documento.helper.js';

describe('helpers de documentos', () => {
  it('normaliza documentos válidos', () => {
    expect(normalizarCnpj('11.222.333/0001-81')).toBe('11222333000181');
    expect(normalizarCep('01001-000')).toBe('01001000');
  });

  it('rejeita CNPJ e CEP inválidos', () => {
    expect(normalizarCnpj('11.111.111/1111-11')).toBeNull();
    expect(normalizarCnpj('11.222.333/0001-82')).toBeNull();
    expect(normalizarCep('123')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { normalizarTelefone } from '../../src/helpers/telefone.helper.js';

describe('normalizarTelefone', () => {
  it('normaliza telefone com código internacional', () => {
    expect(normalizarTelefone('+55 (11) 99999-9999')).toBe('+5511999999999');
  });

  it('converte o prefixo internacional 00', () => {
    expect(normalizarTelefone('0055 11 99999-9999')).toBe('+5511999999999');
  });

  it('rejeita quantidade inválida de dígitos', () => {
    expect(normalizarTelefone('123')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { centavosParaReais, reaisParaCentavos } from '../../src/helpers/moeda.helper.js';

describe('helpers de moeda', () => {
  it('converte string em reais para centavos sem erro de ponto flutuante', () => {
    expect(reaisParaCentavos('10,99')).toBe(1099);
  });

  it('converte valor negativo', () => {
    expect(reaisParaCentavos('-10.99')).toBe(-1099);
  });

  it('rejeita mais de duas casas decimais em strings', () => {
    expect(reaisParaCentavos('10,999')).toBeNull();
  });

  it('converte centavos para reais', () => {
    expect(centavosParaReais(1099)).toBe(10.99);
  });

  it('rejeita centavos fracionários', () => {
    expect(centavosParaReais(10.5)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { serializarDataUtc } from '../../src/helpers/data.helper.js';

describe('serializarDataUtc', () => {
  it('serializa a data no fuso UTC', () => {
    expect(serializarDataUtc('2026-07-29T12:00:00-03:00')).toBe('2026-07-29T15:00:00.000Z');
  });

  it('rejeita uma data inválida', () => {
    expect(serializarDataUtc('data-invalida')).toBeNull();
  });
});

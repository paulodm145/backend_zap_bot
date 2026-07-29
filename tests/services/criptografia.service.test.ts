import { describe, expect, it } from 'vitest';

import { CriptografiaService } from '../../src/services/criptografia.service.js';

describe('CriptografiaService', () => {
  const servico = new CriptografiaService(
    'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  );

  it('criptografa com versão e recupera o valor original', () => {
    const original = 'postgresql://usuario:senha@host:5432/banco';
    const payload = servico.criptografar(original);
    expect(payload).toMatch(/^v1\./);
    expect(payload).not.toContain(original);
    expect(servico.descriptografar(payload)).toBe(original);
  });

  it('recusa payload adulterado ou incompatível', () => {
    expect(() => servico.descriptografar('v2.invalido')).toThrow(
      'Payload criptografado inválido ou incompatível',
    );
  });
});

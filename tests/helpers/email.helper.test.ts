import { describe, expect, it } from 'vitest';

import { normalizarEmail } from '../../src/helpers/email.helper.js';

describe('normalizarEmail', () => {
  it('remove espaços externos e converte para minúsculas', () => {
    expect(normalizarEmail('  Usuario@Empresa.COM.BR ')).toBe('usuario@empresa.com.br');
  });
});

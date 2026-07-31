import { describe, expect, it } from 'vitest';

import { lerArgumentosNomeados } from '../../src/helpers/argumentos-cli.helper.js';

describe('argumentos nomeados de CLI', () => {
  it('converte pares nome e valor sem perder caracteres da senha', () => {
    expect(
      lerArgumentosNomeados([
        '--nome',
        'Administrador Geral',
        '--email',
        'admin@empresa.com',
        '--senha',
        'Senha!Com$Caracteres',
      ]),
    ).toEqual({
      nome: 'Administrador Geral',
      email: 'admin@empresa.com',
      senha: 'Senha!Com$Caracteres',
    });
  });

  it.each([
    { argumentos: ['nome', 'Administrador'], mensagem: 'Argumento inválido' },
    { argumentos: ['--nome'], mensagem: 'Informe um valor' },
    { argumentos: ['--nome', '--email'], mensagem: 'Informe um valor' },
    {
      argumentos: ['--nome', 'Primeiro', '--nome', 'Segundo'],
      mensagem: 'foi informado mais de uma vez',
    },
  ])('recusa argumentos inválidos: $mensagem', ({ argumentos, mensagem }) => {
    expect(() => lerArgumentosNomeados(argumentos)).toThrow(mensagem);
  });
});

import { describe, expect, it } from 'vitest';

import {
  interpolarTemplate,
  variaveisDoTemplate,
} from '../../src/helpers/template-fluxo.helper.js';

describe('interpolarTemplate', () => {
  it('substitui variáveis presentes', () => {
    const resultado = interpolarTemplate('https://api.test/pedidos/{{pedido.id}}', {
      'pedido.id': '4821',
    });
    expect(resultado).toEqual({ completo: true, texto: 'https://api.test/pedidos/4821' });
  });

  it('aceita espaço dentro do marcador', () => {
    const resultado = interpolarTemplate('{{ nome }}', { nome: 'Ana' });
    expect(resultado).toEqual({ completo: true, texto: 'Ana' });
  });

  it('relata variáveis ausentes em vez de substituir por vazio', () => {
    const resultado = interpolarTemplate('{{a}}/{{b}}/{{a}}', { b: '2' });
    expect(resultado).toEqual({ completo: false, ausentes: ['a'] });
  });

  it('mantém texto sem marcador intacto', () => {
    expect(interpolarTemplate('https://api.test/fixo', {})).toEqual({
      completo: true,
      texto: 'https://api.test/fixo',
    });
  });

  it('não interpreta conteúdo do valor como novo marcador', () => {
    const resultado = interpolarTemplate('{{a}}', { a: '{{b}}', b: 'invasor' });
    expect(resultado).toEqual({ completo: true, texto: '{{b}}' });
  });

  it('lista as variáveis exigidas sem repetição', () => {
    expect(variaveisDoTemplate('{{a}}/{{b}}/{{a}}')).toEqual(['a', 'b']);
    expect(variaveisDoTemplate('sem marcador')).toEqual([]);
  });
});

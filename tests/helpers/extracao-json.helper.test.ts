import { describe, expect, it } from 'vitest';

import { extrairCaminho } from '../../src/helpers/extracao-json.helper.js';

const resposta = {
  dados: {
    status: 'APROVADO',
    total: 1250.5,
    pago: true,
    itens: [{ nome: 'Item A' }, { nome: 'Item B' }],
    vazio: null,
    objeto: { a: 1 },
  },
};

describe('extrairCaminho', () => {
  it('extrai texto, número e booleano como string', () => {
    expect(extrairCaminho(resposta, '$.dados.status')).toEqual({
      encontrado: true,
      valor: 'APROVADO',
    });
    expect(extrairCaminho(resposta, '$.dados.total')).toEqual({
      encontrado: true,
      valor: '1250.5',
    });
    expect(extrairCaminho(resposta, '$.dados.pago')).toEqual({ encontrado: true, valor: 'true' });
  });

  it('navega por índice de array', () => {
    expect(extrairCaminho(resposta, '$.dados.itens[1].nome')).toEqual({
      encontrado: true,
      valor: 'Item B',
    });
  });

  it('recusa caminho inexistente', () => {
    expect(extrairCaminho(resposta, '$.dados.ausente')).toEqual({
      encontrado: false,
      motivo: 'CAMINHO_INEXISTENTE',
    });
    expect(extrairCaminho(resposta, '$.dados.itens[9].nome')).toEqual({
      encontrado: false,
      motivo: 'CAMINHO_INEXISTENTE',
    });
    expect(extrairCaminho(resposta, '$.dados.vazio')).toEqual({
      encontrado: false,
      motivo: 'CAMINHO_INEXISTENTE',
    });
  });

  it('recusa objeto e array como valor final', () => {
    expect(extrairCaminho(resposta, '$.dados.objeto')).toEqual({
      encontrado: false,
      motivo: 'VALOR_NAO_TEXTUAL',
    });
    expect(extrairCaminho(resposta, '$.dados.itens')).toEqual({
      encontrado: false,
      motivo: 'VALOR_NAO_TEXTUAL',
    });
  });

  it('não alcança propriedade herdada do prototype', () => {
    expect(extrairCaminho(resposta, '$.constructor')).toEqual({
      encontrado: false,
      motivo: 'CAMINHO_INEXISTENTE',
    });
    expect(extrairCaminho(resposta, '$.dados.toString')).toEqual({
      encontrado: false,
      motivo: 'CAMINHO_INEXISTENTE',
    });
  });

  it('trata origem não objeto', () => {
    expect(extrairCaminho(null, '$.a')).toEqual({
      encontrado: false,
      motivo: 'CAMINHO_INEXISTENTE',
    });
    expect(extrairCaminho('texto', '$.a')).toEqual({
      encontrado: false,
      motivo: 'CAMINHO_INEXISTENTE',
    });
  });
});

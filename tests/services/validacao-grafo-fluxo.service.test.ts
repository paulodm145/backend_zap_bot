import { describe, expect, it } from 'vitest';

import { definicaoFluxoSchema, type DefinicaoFluxo } from '../../src/dtos/fluxo.dto.js';
import { ValidacaoGrafoFluxoService } from '../../src/services/validacao-grafo-fluxo.service.js';

const setorValido = '11111111-1111-4111-8111-111111111111';
const setores = {
  buscarPublicIdsAtivos: (ids: string[]) =>
    Promise.resolve(new Set(ids.filter((id) => id === setorValido))),
};
const validador = new ValidacaoGrafoFluxoService(setores);

function definicaoMinima(): DefinicaoFluxo {
  return definicaoFluxoSchema.parse({
    schemaVersao: 1,
    noInicial: 'inicio',
    nos: [{ id: 'inicio', tipo: 'mensagem', dados: { texto: 'Olá' } }],
  });
}

describe('validação do grafo de fluxo', () => {
  it('aceita um grafo mínimo válido', async () => {
    await expect(validador.validar(definicaoMinima())).resolves.toEqual([]);
  });

  it.each([
    {
      nome: 'nó inicial inexistente',
      alterar: (definicao: DefinicaoFluxo) => ({ ...definicao, noInicial: 'ausente' }),
      codigo: 'NO_INICIAL_INEXISTENTE',
    },
    {
      nome: 'id duplicado',
      alterar: (definicao: DefinicaoFluxo) => ({
        ...definicao,
        nos: [...definicao.nos, definicao.nos[0]],
      }),
      codigo: 'NO_DUPLICADO',
    },
    {
      nome: 'referência inexistente',
      alterar: (definicao: DefinicaoFluxo) => ({
        ...definicao,
        nos: [{ id: 'inicio', tipo: 'mensagem' as const, dados: { texto: 'Olá' }, proximo: 'fim' }],
      }),
      codigo: 'REFERENCIA_INEXISTENTE',
    },
    {
      nome: 'nó inalcançável',
      alterar: (definicao: DefinicaoFluxo) => ({
        ...definicao,
        nos: [
          ...definicao.nos,
          { id: 'orfao', tipo: 'mensagem' as const, dados: { texto: 'Órfão' } },
        ],
      }),
      codigo: 'NO_INALCANCAVEL',
    },
    {
      nome: 'ciclo',
      alterar: (definicao: DefinicaoFluxo) => ({
        ...definicao,
        nos: [
          { id: 'inicio', tipo: 'mensagem' as const, dados: { texto: 'A' }, proximo: 'b' },
          { id: 'b', tipo: 'mensagem' as const, dados: { texto: 'B' }, proximo: 'inicio' },
        ],
      }),
      codigo: 'CICLO_NAO_PERMITIDO',
    },
    {
      nome: 'condição inválida',
      alterar: (definicao: DefinicaoFluxo) => ({
        ...definicao,
        nos: [
          {
            id: 'inicio',
            tipo: 'condicao' as const,
            dados: {
              regras: [{ se: 'codigo perigoso()', entao: 'fim' }],
              padrao: 'fim',
            },
          },
          { id: 'fim', tipo: 'mensagem' as const, dados: { texto: 'Fim' } },
        ],
      }),
      codigo: 'CONDICAO_INVALIDA',
    },
    {
      nome: 'setor inativo',
      alterar: (definicao: DefinicaoFluxo) => ({
        ...definicao,
        nos: [
          {
            id: 'inicio',
            tipo: 'direcionar_setor' as const,
            dados: { setorId: '22222222-2222-4222-8222-222222222222' },
          },
        ],
      }),
      codigo: 'SETOR_INVALIDO',
    },
  ])('retorna erro localizado para $nome', async ({ alterar, codigo }) => {
    const alterada = definicaoFluxoSchema.parse(alterar(definicaoMinima()));
    const erros = await validador.validar(alterada);
    expect(erros).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo,
          campo: expect.any(String) as string,
        }),
      ]),
    );
  });
});

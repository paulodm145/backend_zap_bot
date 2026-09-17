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

  describe('nó de integração', () => {
    const credencialValida = '33333333-3333-4333-8333-333333333333';
    const baseUrl = 'https://api.erp-exemplo.com/v1';
    const credenciais = {
      buscarConfiguracao: (publicId: string) =>
        Promise.resolve(
          publicId === credencialValida ? { public_id: publicId, base_url: baseUrl } : null,
        ),
    };
    const comCredenciais = new ValidacaoGrafoFluxoService(setores, credenciais);

    function definicaoComIntegracao(dados: Record<string, unknown>): DefinicaoFluxo {
      return definicaoFluxoSchema.parse({
        schemaVersao: 1,
        noInicial: 'consultar',
        nos: [
          {
            id: 'consultar',
            tipo: 'integracao_http',
            dados: {
              credencialId: credencialValida,
              metodo: 'GET',
              url: `${baseUrl}/pedidos/{{pedido}}`,
              mapeamentoResposta: { status: '$.dados.status' },
              ...dados,
            },
            sucesso: 'fim',
          },
          { id: 'fim', tipo: 'mensagem', dados: { texto: 'ok' } },
        ],
      });
    }

    it('aceita integração com credencial ativa e URL dentro da base', async () => {
      await expect(comCredenciais.validar(definicaoComIntegracao({}))).resolves.toEqual([]);
    });

    it('recusa credencial inexistente ou inativa', async () => {
      const erros = await comCredenciais.validar(
        definicaoComIntegracao({ credencialId: '44444444-4444-4444-8444-444444444444' }),
      );
      expect(erros).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ codigo: 'CREDENCIAL_INVALIDA', campo: 'dados.credencialId' }),
        ]),
      );
    });

    it.each([
      ['outro domínio', 'https://api.invasor.test/v1/pedidos/1'],
      ['prefixo parecido', 'https://api.erp-exemplo.com.invasor.test/v1/pedidos/1'],
      ['fora do caminho base', 'https://api.erp-exemplo.com/v2/pedidos/1'],
    ])('recusa URL de %s', async (_nome, url) => {
      const erros = await comCredenciais.validar(definicaoComIntegracao({ url }));
      expect(erros).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ codigo: 'URL_FORA_DA_CREDENCIAL', campo: 'dados.url' }),
        ]),
      );
    });

    it('valida sucesso e falha como referências do grafo', async () => {
      const definicao = definicaoFluxoSchema.parse({
        schemaVersao: 1,
        noInicial: 'consultar',
        nos: [
          {
            id: 'consultar',
            tipo: 'integracao_http',
            dados: {
              credencialId: credencialValida,
              metodo: 'GET',
              url: `${baseUrl}/pedidos/1`,
              mapeamentoResposta: {},
            },
            sucesso: 'inexistente',
          },
        ],
      });
      const erros = await comCredenciais.validar(definicao);
      expect(erros).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ codigo: 'REFERENCIA_INEXISTENTE', campo: 'sucesso' }),
        ]),
      );
    });

    it('sinaliza quando não há como validar a credencial', async () => {
      const erros = await validador.validar(definicaoComIntegracao({}));
      expect(erros).toEqual(
        expect.arrayContaining([expect.objectContaining({ codigo: 'INTEGRACAO_INDISPONIVEL' })]),
      );
    });
  });
});

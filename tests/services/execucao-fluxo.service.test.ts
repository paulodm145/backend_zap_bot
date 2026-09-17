import { describe, expect, it, vi } from 'vitest';

import { definicaoFluxoSchema } from '../../src/dtos/fluxo.dto.js';
import { ExecucaoFluxoService } from '../../src/services/execucao-fluxo.service.js';
import { MotorFluxoService } from '../../src/services/motor-fluxo.service.js';

const versao = {
  public_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  definicao: definicaoFluxoSchema.parse({
    schemaVersao: 1,
    noInicial: 'inicio',
    nos: [{ id: 'inicio', tipo: 'mensagem', dados: { texto: 'Persistida' } }],
  }),
};

describe('execução persistida de fluxo', () => {
  it('carrega a versão publicada e salva snapshot namespacado', async () => {
    const estados = {
      carregar: vi.fn().mockResolvedValue(null),
      salvar: vi.fn().mockResolvedValue(undefined),
    };
    const fluxos = {
      buscarVersaoPorPublicId: vi.fn().mockResolvedValue(null),
      buscarVersaoPublicada: vi.fn().mockResolvedValue({ versoes: [versao] }),
    };
    const servico = new ExecucaoFluxoService(fluxos, estados, new MotorFluxoService());

    const resultado = await servico.executarConversa({
      tenantId: 'tenant-publico',
      conversaId: 'conversa-publica',
      fluxoId: 'fluxo-publico',
    });

    expect(resultado.estado.concluido).toBe(true);
    expect(estados.salvar).toHaveBeenCalledWith(
      'tenant-publico',
      'conversa-publica',
      expect.objectContaining({ fluxoVersaoId: versao.public_id }),
    );
  });

  it('persiste o direcionamento produzido pelo nó de setor', async () => {
    const estados = { carregar: vi.fn().mockResolvedValue(null), salvar: vi.fn() };
    const fluxos = {
      buscarVersaoPorPublicId: vi.fn(),
      buscarVersaoPublicada: vi.fn().mockResolvedValue({
        versoes: [
          {
            public_id: versao.public_id,
            definicao: {
              schemaVersao: 1,
              noInicial: 'setor',
              nos: [
                {
                  id: 'setor',
                  tipo: 'direcionar_setor',
                  dados: { setorId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
                },
              ],
            },
          },
        ],
      }),
    };
    const direcionamentos = { direcionarPeloFluxo: vi.fn().mockResolvedValue(true) };
    const servico = new ExecucaoFluxoService(
      fluxos,
      estados,
      new MotorFluxoService(),
      direcionamentos,
    );
    await servico.executarConversa({
      tenantId: 'tenant',
      conversaId: 'conversa',
      fluxoId: 'fluxo',
    });
    expect(direcionamentos.direcionarPeloFluxo).toHaveBeenCalledWith(
      'conversa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      expect.objectContaining({ concluido: true }),
    );
  });

  describe('nó de integração', () => {
    const credencialId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const definicaoIntegracao = {
      schemaVersao: 1,
      noInicial: 'consultar',
      nos: [
        {
          id: 'consultar',
          tipo: 'integracao_http',
          dados: {
            credencialId,
            metodo: 'GET',
            url: 'https://api.test/v1/pedidos/{{pedido}}',
            mapeamentoResposta: { status: '$.dados.status' },
          },
          sucesso: 'ok',
          falha: 'erro',
        },
        { id: 'ok', tipo: 'mensagem', dados: { texto: 'Consulta concluída' } },
        { id: 'erro', tipo: 'mensagem', dados: { texto: 'Falhou' } },
      ],
    };

    function ambiente(
      http: { executar: ReturnType<typeof vi.fn> },
      estadoSalvo: Record<string, string> = { pedido: '77' },
    ) {
      const estados = {
        carregar: vi.fn().mockResolvedValue({
          fluxoVersaoId: versao.public_id,
          noAtualId: 'consultar',
          variaveis: estadoSalvo,
          concluido: false,
          passosExecutados: 0,
        }),
        salvar: vi.fn().mockResolvedValue(undefined),
      };
      const fluxos = {
        buscarVersaoPorPublicId: vi
          .fn()
          .mockResolvedValue({ public_id: versao.public_id, definicao: definicaoIntegracao }),
        buscarVersaoPublicada: vi.fn(),
      };
      const credenciais = {
        buscarConfiguracao: vi.fn().mockResolvedValue({
          public_id: credencialId,
          base_url: 'https://api.test/v1',
          configuracao_encrypted: 'cifrado',
        }),
      };
      const criptografia = {
        criptografar: vi.fn(),
        descriptografar: vi.fn().mockReturnValue(JSON.stringify({ tipo: 'NENHUMA' })),
      };
      const servico = new ExecucaoFluxoService(
        fluxos,
        estados,
        new MotorFluxoService(),
        undefined,
        { credenciais, http, criptografia } as never,
      );
      return { servico, estados, credenciais, criptografia };
    }

    it('executa a chamada, grava variáveis e segue por sucesso', async () => {
      const http = {
        executar: vi
          .fn()
          .mockResolvedValue({ sucesso: true, status: 200, corpo: { dados: { status: 'PAGO' } } }),
      };
      const { servico, estados } = ambiente(http);
      const resultado = await servico.executarConversa({
        tenantId: 'tenant',
        conversaId: 'conversa',
        fluxoId: 'fluxo',
      });

      expect(http.executar).toHaveBeenCalledWith(
        expect.objectContaining({
          metodo: 'GET',
          url: 'https://api.test/v1/pedidos/77',
          baseUrlAutorizada: 'https://api.test/v1',
        }),
      );
      expect(resultado.estado.variaveis.status).toBe('PAGO');
      expect(resultado.saidas).toContainEqual(
        expect.objectContaining({ tipo: 'mensagem', noId: 'ok' }),
      );
      expect(estados.salvar).toHaveBeenCalled();
    });

    it('segue por falha quando a chamada não tem sucesso', async () => {
      const http = {
        executar: vi.fn().mockResolvedValue({ sucesso: false, falha: 'STATUS_ERRO' }),
      };
      const { servico } = ambiente(http);
      const resultado = await servico.executarConversa({
        tenantId: 'tenant',
        conversaId: 'conversa',
        fluxoId: 'fluxo',
      });
      expect(resultado.saidas).toContainEqual(
        expect.objectContaining({ tipo: 'mensagem', noId: 'erro' }),
      );
    });

    it('segue por falha sem chamar a rede quando falta variável da URL', async () => {
      const http = { executar: vi.fn() };
      const { servico } = ambiente(http, {});
      const resultado = await servico.executarConversa({
        tenantId: 'tenant',
        conversaId: 'conversa',
        fluxoId: 'fluxo',
      });
      expect(http.executar).not.toHaveBeenCalled();
      expect(resultado.saidas).toContainEqual(
        expect.objectContaining({ tipo: 'mensagem', noId: 'erro' }),
      );
    });

    it('segue por falha quando a credencial não está mais ativa', async () => {
      const http = { executar: vi.fn() };
      const { servico, credenciais } = ambiente(http);
      credenciais.buscarConfiguracao.mockResolvedValue(null);
      const resultado = await servico.executarConversa({
        tenantId: 'tenant',
        conversaId: 'conversa',
        fluxoId: 'fluxo',
      });
      expect(http.executar).not.toHaveBeenCalled();
      expect(resultado.saidas).toContainEqual(
        expect.objectContaining({ tipo: 'mensagem', noId: 'erro' }),
      );
    });
  });
});

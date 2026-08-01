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
});

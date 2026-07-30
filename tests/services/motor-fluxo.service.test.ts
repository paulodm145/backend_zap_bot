import { describe, expect, it } from 'vitest';

import { definicaoFluxoSchema, type DefinicaoFluxo } from '../../src/dtos/fluxo.dto.js';
import { MotorFluxoService } from '../../src/services/motor-fluxo.service.js';

const versaoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const setorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const definicao = definicaoFluxoSchema.parse({
  schemaVersao: 1,
  noInicial: 'boas_vindas',
  nos: [
    {
      id: 'boas_vindas',
      tipo: 'mensagem',
      dados: { texto: 'Escolha 1 para atendimento' },
      proximo: 'capturar_opcao',
    },
    {
      id: 'capturar_opcao',
      tipo: 'captura_resposta',
      dados: { variavel: 'opcao' },
      proximo: 'decidir',
    },
    {
      id: 'decidir',
      tipo: 'condicao',
      dados: {
        regras: [{ se: 'opcao == "1"', entao: 'direcionar' }],
        padrao: 'tentar_novamente',
      },
    },
    {
      id: 'direcionar',
      tipo: 'direcionar_setor',
      dados: { setorId },
    },
    {
      id: 'tentar_novamente',
      tipo: 'mensagem',
      dados: { texto: 'Opção inválida' },
    },
  ],
});

describe('motor determinístico de fluxo', () => {
  const motor = new MotorFluxoService();

  it('executa mensagem e pausa aguardando captura', () => {
    const resultado = motor.executar({
      definicao,
      fluxoVersaoId: versaoId,
      maxPassos: 50,
    });

    expect(resultado.saidas).toEqual([
      { tipo: 'mensagem', texto: 'Escolha 1 para atendimento', noId: 'boas_vindas' },
      { tipo: 'captura', variavel: 'opcao', noId: 'capturar_opcao' },
    ]);
    expect(resultado.estado.aguardandoCaptura?.variavel).toBe('opcao');
  });

  it('captura resposta, avalia condição segura e direciona ao setor', () => {
    const inicial = motor.executar({
      definicao,
      fluxoVersaoId: versaoId,
      maxPassos: 50,
    });
    const resultado = motor.executar({
      definicao,
      fluxoVersaoId: versaoId,
      estado: inicial.estado,
      mensagem: '1',
      maxPassos: 50,
    });

    expect(resultado.estado).toMatchObject({
      concluido: true,
      setorId,
      variaveis: { opcao: '1' },
    });
    expect(resultado.saidas).toContainEqual({
      tipo: 'direcionamento',
      setorId,
      noId: 'direcionar',
    });
  });

  it('usa a saída padrão quando nenhuma condição corresponde', () => {
    const inicial = motor.executar({
      definicao,
      fluxoVersaoId: versaoId,
      maxPassos: 50,
    });
    const resultado = motor.executar({
      definicao,
      fluxoVersaoId: versaoId,
      estado: inicial.estado,
      mensagem: 'outra',
      maxPassos: 50,
    });

    expect(resultado.saidas).toContainEqual({
      tipo: 'mensagem',
      texto: 'Opção inválida',
      noId: 'tentar_novamente',
    });
    expect(resultado.estado.concluido).toBe(true);
  });

  it('interrompe uma definição cíclica pelo limite de passos', () => {
    const ciclica = {
      schemaVersao: 1,
      noInicial: 'inicio',
      nos: [{ id: 'inicio', tipo: 'mensagem', dados: { texto: 'Loop' }, proximo: 'inicio' }],
    } as unknown as DefinicaoFluxo;

    expect(() =>
      motor.executar({
        definicao: ciclica,
        fluxoVersaoId: versaoId,
        maxPassos: 3,
      }),
    ).toThrow('excedeu o limite');
  });

  it('trata tipo de nó desconhecido como erro de domínio', () => {
    const desconhecida = {
      schemaVersao: 1,
      noInicial: 'inicio',
      nos: [{ id: 'inicio', tipo: 'codigo_arbitrario', dados: {} }],
    } as unknown as DefinicaoFluxo;

    expect(() =>
      motor.executar({
        definicao: desconhecida,
        fluxoVersaoId: versaoId,
        maxPassos: 3,
      }),
    ).toThrow('Tipo de nó desconhecido');
  });
});

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

  it('pausa no nó de integração sem executar I/O e retoma pelo resultado', () => {
    const credencialId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const comIntegracao = definicaoFluxoSchema.parse({
      schemaVersao: 1,
      noInicial: 'consultar',
      nos: [
        {
          id: 'consultar',
          tipo: 'integracao_http',
          dados: {
            credencialId,
            metodo: 'GET',
            url: 'https://api.test/v1/pedidos/1',
            mapeamentoResposta: { status: '$.dados.status' },
          },
          sucesso: 'deu_certo',
          falha: 'deu_errado',
        },
        { id: 'deu_certo', tipo: 'mensagem', dados: { texto: 'Status {{status}}' } },
        { id: 'deu_errado', tipo: 'mensagem', dados: { texto: 'Não consegui consultar' } },
      ],
    });

    const pausa = motor.executar({
      definicao: comIntegracao,
      fluxoVersaoId: versaoId,
      maxPassos: 10,
    });
    expect(pausa.saidas).toEqual([
      expect.objectContaining({ tipo: 'integracao', noId: 'consultar' }),
    ]);
    expect(pausa.estado.aguardandoIntegracao).toEqual({ noId: 'consultar' });
    expect(pausa.estado.concluido).toBe(false);

    const sucesso = motor.executar({
      definicao: comIntegracao,
      fluxoVersaoId: versaoId,
      estado: pausa.estado,
      resultadoIntegracao: { noId: 'consultar', sucesso: true, variaveis: { status: 'APROVADO' } },
      maxPassos: 10,
    });
    expect(sucesso.estado.variaveis.status).toBe('APROVADO');
    expect(sucesso.estado.aguardandoIntegracao).toBeUndefined();
    expect(sucesso.saidas).toEqual([
      expect.objectContaining({ tipo: 'mensagem', noId: 'deu_certo' }),
    ]);

    const falha = motor.executar({
      definicao: comIntegracao,
      fluxoVersaoId: versaoId,
      estado: pausa.estado,
      resultadoIntegracao: { noId: 'consultar', sucesso: false, variaveis: {} },
      maxPassos: 10,
    });
    expect(falha.saidas).toEqual([
      expect.objectContaining({ tipo: 'mensagem', noId: 'deu_errado' }),
    ]);
  });

  it('encerra o fluxo quando a saída escolhida da integração não está ligada', () => {
    const semFalha = definicaoFluxoSchema.parse({
      schemaVersao: 1,
      noInicial: 'consultar',
      nos: [
        {
          id: 'consultar',
          tipo: 'integracao_http',
          dados: {
            credencialId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            metodo: 'GET',
            url: 'https://api.test/v1/x',
            mapeamentoResposta: {},
          },
          sucesso: 'fim',
        },
        { id: 'fim', tipo: 'mensagem', dados: { texto: 'ok' } },
      ],
    });
    const pausa = motor.executar({
      definicao: semFalha,
      fluxoVersaoId: versaoId,
      maxPassos: 10,
    });
    const resultado = motor.executar({
      definicao: semFalha,
      fluxoVersaoId: versaoId,
      estado: pausa.estado,
      resultadoIntegracao: { noId: 'consultar', sucesso: false, variaveis: {} },
      maxPassos: 10,
    });
    expect(resultado.estado.concluido).toBe(true);
    expect(resultado.saidas).toEqual([]);
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

import type { DefinicaoFluxo, EstadoConversaFluxo, NoFluxo } from '../dtos/fluxo.dto.js';
import {
  LimiteExecucaoFluxoError,
  NoFluxoDesconhecidoError,
  ValidacaoError,
} from '../erros/erro-aplicacao.js';
import { avaliarCondicao } from '../helpers/condicao-fluxo.helper.js';

export type SaidaExecucaoFluxo =
  | { tipo: 'mensagem'; texto: string; noId: string }
  | { tipo: 'captura'; mensagem?: string; variavel: string; noId: string }
  | { tipo: 'direcionamento'; setorId: string; noId: string };

export interface EntradaMotorFluxo {
  definicao: DefinicaoFluxo;
  fluxoVersaoId: string;
  estado?: EstadoConversaFluxo;
  mensagem?: string;
  maxPassos: number;
}

export interface ResultadoMotorFluxo {
  estado: EstadoConversaFluxo;
  saidas: SaidaExecucaoFluxo[];
}

export class MotorFluxoService {
  public executar(entrada: EntradaMotorFluxo): ResultadoMotorFluxo {
    const nos = new Map(entrada.definicao.nos.map((no) => [no.id, no]));
    let estado: EstadoConversaFluxo = entrada.estado
      ? {
          ...entrada.estado,
          variaveis: { ...entrada.estado.variaveis },
        }
      : {
          fluxoVersaoId: entrada.fluxoVersaoId,
          noAtualId: entrada.definicao.noInicial,
          variaveis: {},
          concluido: false,
          passosExecutados: 0,
        };

    if (estado.fluxoVersaoId !== entrada.fluxoVersaoId) {
      throw new ValidacaoError('O estado pertence a outra versão do fluxo');
    }
    if (estado.concluido) return { estado, saidas: [] };

    const saidas: SaidaExecucaoFluxo[] = [];
    let passosNestaExecucao = 0;
    let mensagemDisponivel = entrada.mensagem;

    while (estado.noAtualId && !estado.concluido) {
      if (passosNestaExecucao >= entrada.maxPassos) {
        throw new LimiteExecucaoFluxoError();
      }

      const no = nos.get(estado.noAtualId);
      if (!no) {
        throw new ValidacaoError(`Nó atual não encontrado: ${estado.noAtualId}`);
      }

      passosNestaExecucao += 1;
      estado = {
        ...estado,
        passosExecutados: estado.passosExecutados + 1,
      };

      const resultado = this.executarNo(no, estado, mensagemDisponivel);
      estado = resultado.estado;
      saidas.push(...resultado.saidas);
      if (resultado.consumiuMensagem) mensagemDisponivel = undefined;
      if (resultado.pausar) break;
    }

    return { estado, saidas };
  }

  private executarNo(
    no: NoFluxo,
    estado: EstadoConversaFluxo,
    mensagem: string | undefined,
  ): {
    estado: EstadoConversaFluxo;
    saidas: SaidaExecucaoFluxo[];
    pausar: boolean;
    consumiuMensagem: boolean;
  } {
    switch (no.tipo) {
      case 'mensagem':
        return {
          estado: this.avancar(estado, no.proximo),
          saidas: [{ tipo: 'mensagem', texto: no.dados.texto, noId: no.id }],
          pausar: false,
          consumiuMensagem: false,
        };
      case 'captura_resposta': {
        const aguardando = estado.aguardandoCaptura?.noId === no.id;
        if (aguardando && mensagem !== undefined) {
          return {
            estado: this.avancar(
              {
                ...estado,
                variaveis: {
                  ...estado.variaveis,
                  [no.dados.variavel]: mensagem,
                },
                aguardandoCaptura: undefined,
              },
              no.proximo,
            ),
            saidas: [],
            pausar: false,
            consumiuMensagem: true,
          };
        }
        return {
          estado: {
            ...estado,
            aguardandoCaptura: {
              noId: no.id,
              variavel: no.dados.variavel,
              ...(no.proximo ? { proximo: no.proximo } : {}),
            },
          },
          saidas: [
            {
              tipo: 'captura',
              variavel: no.dados.variavel,
              noId: no.id,
              ...(no.dados.mensagem ? { mensagem: no.dados.mensagem } : {}),
            },
          ],
          pausar: true,
          consumiuMensagem: false,
        };
      }
      case 'condicao': {
        const regra = no.dados.regras.find((item) => avaliarCondicao(item.se, estado.variaveis));
        return {
          estado: this.avancar(estado, regra?.entao ?? no.dados.padrao),
          saidas: [],
          pausar: false,
          consumiuMensagem: false,
        };
      }
      case 'direcionar_setor':
        return {
          estado: {
            ...estado,
            setorId: no.dados.setorId,
            noAtualId: null,
            concluido: true,
          },
          saidas: [
            {
              tipo: 'direcionamento',
              setorId: no.dados.setorId,
              noId: no.id,
            },
          ],
          pausar: true,
          consumiuMensagem: false,
        };
      default:
        return this.noDesconhecido(no);
    }
  }

  private avancar(estado: EstadoConversaFluxo, proximo: string | undefined): EstadoConversaFluxo {
    return {
      ...estado,
      noAtualId: proximo ?? null,
      concluido: proximo === undefined,
    };
  }

  private noDesconhecido(no: never): never {
    const tipo = (no as { tipo?: unknown }).tipo;
    throw new NoFluxoDesconhecidoError(typeof tipo === 'string' ? tipo : 'indefinido');
  }
}

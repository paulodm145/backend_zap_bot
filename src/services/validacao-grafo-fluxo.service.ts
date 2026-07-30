import type { DefinicaoFluxo, NoFluxo } from '../dtos/fluxo.dto.js';
import { interpretarCondicao } from '../helpers/condicao-fluxo.helper.js';

export interface ErroValidacaoGrafo {
  codigo: string;
  campo: string;
  mensagem: string;
  noId?: string;
}

interface LeitorSetores {
  buscarPublicIdsAtivos(publicIds: string[]): Promise<Set<string>>;
}

export class ValidacaoGrafoFluxoService {
  public constructor(private readonly setores: LeitorSetores) {}

  public async validar(definicao: DefinicaoFluxo): Promise<ErroValidacaoGrafo[]> {
    const erros: ErroValidacaoGrafo[] = [];
    const nosPorId = new Map<string, NoFluxo>();

    for (const no of definicao.nos) {
      if (nosPorId.has(no.id)) {
        erros.push({
          codigo: 'NO_DUPLICADO',
          noId: no.id,
          campo: 'id',
          mensagem: `O identificador "${no.id}" está duplicado`,
        });
      } else {
        nosPorId.set(no.id, no);
      }
    }

    if (!nosPorId.has(definicao.noInicial)) {
      erros.push({
        codigo: 'NO_INICIAL_INEXISTENTE',
        campo: 'noInicial',
        mensagem: 'O nó inicial não existe na definição',
      });
    }

    for (const no of definicao.nos) {
      this.validarReferencias(no, nosPorId, erros);
      if (no.tipo === 'condicao') {
        no.dados.regras.forEach((regra, indice) => {
          try {
            interpretarCondicao(regra.se);
          } catch {
            erros.push({
              codigo: 'CONDICAO_INVALIDA',
              noId: no.id,
              campo: `dados.regras.${String(indice)}.se`,
              mensagem: 'Use variavel == "valor" ou variavel != "valor"',
            });
          }
        });
      }
    }

    this.validarAlcancabilidade(definicao, nosPorId, erros);
    this.validarCiclos(definicao.nos, nosPorId, erros);
    await this.validarSetores(definicao.nos, erros);
    return erros;
  }

  private validarReferencias(
    no: NoFluxo,
    nosPorId: ReadonlyMap<string, NoFluxo>,
    erros: ErroValidacaoGrafo[],
  ): void {
    for (const referencia of this.referencias(no)) {
      if (!nosPorId.has(referencia.id)) {
        erros.push({
          codigo: 'REFERENCIA_INEXISTENTE',
          noId: no.id,
          campo: referencia.campo,
          mensagem: `O nó referenciado "${referencia.id}" não existe`,
        });
      }
    }
  }

  private validarAlcancabilidade(
    definicao: DefinicaoFluxo,
    nosPorId: ReadonlyMap<string, NoFluxo>,
    erros: ErroValidacaoGrafo[],
  ): void {
    const visitados = new Set<string>();
    const pendentes = [definicao.noInicial];
    while (pendentes.length > 0) {
      const atual = pendentes.pop();
      if (!atual || visitados.has(atual)) continue;
      visitados.add(atual);
      const no = nosPorId.get(atual);
      if (!no) continue;
      pendentes.push(...this.referencias(no).map((referencia) => referencia.id));
    }

    for (const no of definicao.nos) {
      if (!visitados.has(no.id)) {
        erros.push({
          codigo: 'NO_INALCANCAVEL',
          noId: no.id,
          campo: 'id',
          mensagem: 'O nó não é alcançável a partir do nó inicial',
        });
      }
    }
  }

  private validarCiclos(
    nos: NoFluxo[],
    nosPorId: ReadonlyMap<string, NoFluxo>,
    erros: ErroValidacaoGrafo[],
  ): void {
    const visitados = new Set<string>();
    const pilha = new Set<string>();
    const ciclosReportados = new Set<string>();

    const visitar = (noId: string): void => {
      if (pilha.has(noId)) {
        if (!ciclosReportados.has(noId)) {
          ciclosReportados.add(noId);
          erros.push({
            codigo: 'CICLO_NAO_PERMITIDO',
            noId,
            campo: 'proximo',
            mensagem: 'O fluxo determinístico não permite ciclos',
          });
        }
        return;
      }
      if (visitados.has(noId)) return;
      visitados.add(noId);
      pilha.add(noId);
      const no = nosPorId.get(noId);
      if (no) {
        for (const referencia of this.referencias(no)) visitar(referencia.id);
      }
      pilha.delete(noId);
    };

    for (const no of nos) visitar(no.id);
  }

  private async validarSetores(nos: NoFluxo[], erros: ErroValidacaoGrafo[]): Promise<void> {
    const ids = [
      ...new Set(nos.filter((no) => no.tipo === 'direcionar_setor').map((no) => no.dados.setorId)),
    ];
    if (ids.length === 0) return;
    const existentes = await this.setores.buscarPublicIdsAtivos(ids);
    for (const no of nos) {
      if (no.tipo === 'direcionar_setor' && !existentes.has(no.dados.setorId)) {
        erros.push({
          codigo: 'SETOR_INVALIDO',
          noId: no.id,
          campo: 'dados.setorId',
          mensagem: 'O setor não existe ou está inativo',
        });
      }
    }
  }

  private referencias(no: NoFluxo): { id: string; campo: string }[] {
    if (no.tipo === 'condicao') {
      return [
        ...no.dados.regras.map((regra, indice) => ({
          id: regra.entao,
          campo: `dados.regras.${String(indice)}.entao`,
        })),
        { id: no.dados.padrao, campo: 'dados.padrao' },
      ];
    }
    if (no.tipo === 'direcionar_setor' || !no.proximo) return [];
    return [{ id: no.proximo, campo: 'proximo' }];
  }
}

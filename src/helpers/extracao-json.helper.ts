/**
 * Extração de valor por caminho (`$.pedido.itens[0].status`) na resposta de
 * uma integração.
 *
 * Parser próprio, sem `eval` e sem biblioteca de JSONPath: só navegação por
 * chave e índice, que é o que o bloco de integração precisa. O resultado é
 * sempre `string`, porque as variáveis do fluxo são texto — número e booleano
 * viram sua representação textual, e objeto/array não são extraíveis, já que
 * serializá-los dentro de uma variável não tem uso previsto.
 */

export type ResultadoExtracao =
  | { encontrado: true; valor: string }
  | { encontrado: false; motivo: 'CAMINHO_INEXISTENTE' | 'VALOR_NAO_TEXTUAL' };

type Segmento = { tipo: 'chave'; nome: string } | { tipo: 'indice'; posicao: number };

const SEGMENTO = /\.([A-Za-z_][A-Za-z0-9_]*)|\[(\d{1,4})\]/g;

export function extrairCaminho(origem: unknown, caminho: string): ResultadoExtracao {
  let atual: unknown = origem;
  for (const segmento of segmentos(caminho)) {
    if (atual === null || atual === undefined) {
      return { encontrado: false, motivo: 'CAMINHO_INEXISTENTE' };
    }
    if (segmento.tipo === 'indice') {
      if (!Array.isArray(atual)) return { encontrado: false, motivo: 'CAMINHO_INEXISTENTE' };
      atual = atual[segmento.posicao];
      continue;
    }
    if (typeof atual !== 'object' || Array.isArray(atual)) {
      return { encontrado: false, motivo: 'CAMINHO_INEXISTENTE' };
    }
    if (!Object.hasOwn(atual, segmento.nome)) {
      return { encontrado: false, motivo: 'CAMINHO_INEXISTENTE' };
    }
    atual = (atual as Record<string, unknown>)[segmento.nome];
  }

  if (atual === null || atual === undefined) {
    return { encontrado: false, motivo: 'CAMINHO_INEXISTENTE' };
  }
  if (typeof atual === 'string') return { encontrado: true, valor: atual };
  if (typeof atual === 'number' && Number.isFinite(atual)) {
    return { encontrado: true, valor: String(atual) };
  }
  if (typeof atual === 'boolean') return { encontrado: true, valor: String(atual) };
  return { encontrado: false, motivo: 'VALOR_NAO_TEXTUAL' };
}

function segmentos(caminho: string): Segmento[] {
  const lista: Segmento[] = [];
  for (const ocorrencia of caminho.slice(1).matchAll(SEGMENTO)) {
    const [, chave, indice] = ocorrencia;
    if (chave !== undefined) lista.push({ tipo: 'chave', nome: chave });
    else if (indice !== undefined) lista.push({ tipo: 'indice', posicao: Number(indice) });
  }
  return lista;
}

import { ValidacaoError } from '../erros/erro-aplicacao.js';

interface CondicaoComparacao {
  variavel: string;
  operador: '==' | '!=';
  valor: string;
}

const EXPRESSAO_COMPARACAO = /^\s*([A-Za-z_][A-Za-z0-9_.]{0,79})\s*(==|!=)\s*(['"])([^'"]*)\3\s*$/;

export function interpretarCondicao(expressao: string): CondicaoComparacao {
  const partes = EXPRESSAO_COMPARACAO.exec(expressao);
  const variavel = partes?.[1];
  const operador = partes?.[2];
  const valor = partes?.[4];

  if (!variavel || (operador !== '==' && operador !== '!=') || valor === undefined) {
    throw new ValidacaoError(
      'Condição inválida; use o formato variavel == "valor" ou variavel != "valor"',
    );
  }

  return { variavel, operador, valor };
}

export function avaliarCondicao(
  expressao: string,
  variaveis: Readonly<Record<string, string>>,
): boolean {
  const condicao = interpretarCondicao(expressao);
  const atual = variaveis[condicao.variavel];
  return condicao.operador === '==' ? atual === condicao.valor : atual !== condicao.valor;
}

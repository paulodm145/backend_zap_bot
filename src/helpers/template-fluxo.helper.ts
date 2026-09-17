/**
 * Interpolação de `{{variavel}}` usada pela URL e pelo corpo do nó de
 * integração. Substituição literal por parser próprio: nunca `eval`, nunca
 * template string dinâmica, conforme a regra de fluxos do AGENTS.md.
 *
 * Variável ausente não vira string vazia silenciosa — o chamador recebe a
 * lista de pendências e decide, porque uma URL montada com buraco costuma
 * apontar para o recurso errado em vez de falhar.
 */

const MARCADOR = /\{\{\s*([A-Za-z_][A-Za-z0-9_.]{0,79})\s*\}\}/g;

export type ResultadoInterpolacao =
  { completo: true; texto: string } | { completo: false; ausentes: string[] };

export function interpolarTemplate(
  texto: string,
  variaveis: Readonly<Record<string, string>>,
): ResultadoInterpolacao {
  const ausentes = new Set<string>();
  const resultado = texto.replace(MARCADOR, (_original, nome: string) => {
    const valor = variaveis[nome];
    if (valor === undefined) {
      ausentes.add(nome);
      return '';
    }
    return valor;
  });
  return ausentes.size > 0
    ? { completo: false, ausentes: [...ausentes] }
    : { completo: true, texto: resultado };
}

/** Nomes de variável exigidos por um template, sem repetição. */
export function variaveisDoTemplate(texto: string): string[] {
  const nomes = new Set<string>();
  for (const ocorrencia of texto.matchAll(MARCADOR)) {
    const nome = ocorrencia[1];
    if (nome !== undefined) nomes.add(nome);
  }
  return [...nomes];
}

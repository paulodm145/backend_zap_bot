export function lerArgumentosNomeados(argumentos: readonly string[]): Record<string, string> {
  const resultado: Record<string, string> = {};

  for (let indice = 0; indice < argumentos.length; indice += 1) {
    const argumento = argumentos[indice];
    if (!argumento?.startsWith('--')) {
      throw new Error(`Argumento inválido: ${argumento ?? ''}`);
    }

    const nome = argumento.slice(2);
    const valor = argumentos[indice + 1];
    if (!nome || !valor || valor.startsWith('--')) {
      throw new Error(`Informe um valor para --${nome}`);
    }
    if (resultado[nome] !== undefined) {
      throw new Error(`O argumento --${nome} foi informado mais de uma vez`);
    }

    resultado[nome] = valor;
    indice += 1;
  }

  return resultado;
}

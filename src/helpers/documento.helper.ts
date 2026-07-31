export function normalizarCnpj(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return null;

  const calcularDigito = (base: string, pesos: readonly number[]): number => {
    const soma = base
      .split('')
      .reduce((total, digito, indice) => total + Number(digito) * (pesos[indice] ?? 0), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const primeiro = calcularDigito(digitos.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = calcularDigito(
    `${digitos.slice(0, 12)}${String(primeiro)}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return digitos.endsWith(`${String(primeiro)}${String(segundo)}`) ? digitos : null;
}

export function normalizarCep(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '');
  return /^\d{8}$/.test(digitos) ? digitos : null;
}

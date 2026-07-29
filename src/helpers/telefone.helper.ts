const QUANTIDADE_MINIMA_DIGITOS = 8;
const QUANTIDADE_MAXIMA_DIGITOS = 15;

export function normalizarTelefone(telefone: string): string | null {
  const valorSemEspacos = telefone.trim();
  const comPrefixoInternacional = valorSemEspacos.startsWith('00')
    ? `+${valorSemEspacos.slice(2)}`
    : valorSemEspacos;
  const digitos = comPrefixoInternacional.replace(/\D/g, '');

  if (digitos.length < QUANTIDADE_MINIMA_DIGITOS || digitos.length > QUANTIDADE_MAXIMA_DIGITOS) {
    return null;
  }

  return `+${digitos}`;
}

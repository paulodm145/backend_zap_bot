export function serializarDataUtc(valor: Date | string | number): string | null {
  const data = valor instanceof Date ? valor : new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  return data.toISOString();
}

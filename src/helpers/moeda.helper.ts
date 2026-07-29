export function reaisParaCentavos(valor: number | string): number | null {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) {
      return null;
    }

    const centavos = Math.round(valor * 100);
    return Number.isSafeInteger(centavos) ? centavos : null;
  }

  const valorNormalizado = valor.trim().replace(',', '.');

  if (!/^-?\d+(?:\.\d{1,2})?$/.test(valorNormalizado)) {
    return null;
  }

  const [inteiros = '0', decimais = ''] = valorNormalizado.split('.');
  const sinal = inteiros.startsWith('-') ? -1 : 1;
  const unidades = Number.parseInt(inteiros.replace('-', ''), 10);
  const centavosFracionarios = Number.parseInt(decimais.padEnd(2, '0') || '0', 10);
  const centavos = sinal * (unidades * 100 + centavosFracionarios);

  return Number.isSafeInteger(centavos) ? centavos : null;
}

export function centavosParaReais(centavos: number): number | null {
  if (!Number.isSafeInteger(centavos)) {
    return null;
  }

  return centavos / 100;
}

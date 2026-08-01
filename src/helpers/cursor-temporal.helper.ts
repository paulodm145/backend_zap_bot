export interface CursorTemporal {
  ocorreuAt: Date;
  id: number;
}

export function codificarCursorTemporal(cursor: CursorTemporal): string {
  return Buffer.from(`${cursor.ocorreuAt.toISOString()}|${String(cursor.id)}`, 'utf8').toString(
    'base64url',
  );
}

export function decodificarCursorTemporal(valor: string): CursorTemporal | null {
  try {
    const [dataTexto, idTexto, extra] = Buffer.from(valor, 'base64url').toString('utf8').split('|');
    const ocorreuAt = new Date(dataTexto ?? '');
    const id = Number(idTexto);
    if (
      extra !== undefined ||
      Number.isNaN(ocorreuAt.getTime()) ||
      !Number.isSafeInteger(id) ||
      id <= 0
    )
      return null;
    return { ocorreuAt, id };
  } catch {
    return null;
  }
}

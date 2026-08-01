export function converterTimestampUnixWhatsapp(timestamp: string): Date | null {
  if (!/^\d+$/.test(timestamp)) return null;
  const segundos = Number(timestamp);
  if (!Number.isSafeInteger(segundos) || segundos <= 0) return null;
  const data = new Date(segundos * 1_000);
  return Number.isNaN(data.getTime()) ? null : data;
}

import { createHmac, timingSafeEqual } from 'node:crypto';

export function assinaturaWebhookValida(
  corpoBruto: Buffer,
  assinaturaRecebida: string,
  segredo: string,
): boolean {
  if (!assinaturaRecebida.startsWith('sha256=')) {
    return false;
  }

  const assinaturaEsperada = `sha256=${createHmac('sha256', segredo).update(corpoBruto).digest('hex')}`;
  const esperado = Buffer.from(assinaturaEsperada);
  const recebido = Buffer.from(assinaturaRecebida);

  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

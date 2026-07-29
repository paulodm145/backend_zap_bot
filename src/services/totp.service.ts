import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { TOTP, Secret } from 'otpauth';
import QRCode from 'qrcode';

export class TotpService {
  private readonly chave: Buffer;

  public constructor(chaveHexadecimal: string) {
    this.chave = Buffer.from(chaveHexadecimal, 'hex');
  }

  public gerar(email: string): { segredo: string; uri: string } {
    const segredo = new Secret({ size: 20 });
    const totp = this.criarTotp(segredo, email);
    return { segredo: segredo.base32, uri: totp.toString() };
  }

  public gerarQrCode(uri: string): Promise<string> {
    return QRCode.toDataURL(uri, { errorCorrectionLevel: 'M' });
  }

  public validar(segredoBase32: string, email: string, codigo: string): boolean {
    return (
      this.criarTotp(Secret.fromBase32(segredoBase32), email).validate({
        token: codigo,
        window: 1,
      }) !== null
    );
  }

  public criptografar(valor: string): string {
    const iv = randomBytes(12);
    const cifrador = createCipheriv('aes-256-gcm', this.chave, iv);
    const cifrado = Buffer.concat([cifrador.update(valor, 'utf8'), cifrador.final()]);
    return [iv, cifrador.getAuthTag(), cifrado].map((item) => item.toString('base64url')).join('.');
  }

  public descriptografar(valor: string): string {
    const partes = valor.split('.');
    if (partes.length !== 3) throw new Error('Segredo TOTP criptografado inválido');
    const [ivTexto, tagTexto, cifradoTexto] = partes;
    if (!ivTexto || !tagTexto || !cifradoTexto) {
      throw new Error('Segredo TOTP criptografado inválido');
    }
    const iv = Buffer.from(ivTexto, 'base64url');
    const tag = Buffer.from(tagTexto, 'base64url');
    const cifrado = Buffer.from(cifradoTexto, 'base64url');
    const decifrador = createDecipheriv('aes-256-gcm', this.chave, iv);
    decifrador.setAuthTag(tag);
    return Buffer.concat([decifrador.update(cifrado), decifrador.final()]).toString('utf8');
  }

  private criarTotp(segredo: Secret, email: string): TOTP {
    return new TOTP({
      issuer: 'ZapBot',
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: segredo,
    });
  }
}

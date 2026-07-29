import { criptografarPayload, descriptografarPayload } from '../helpers/criptografia.helper.js';

export class CriptografiaService {
  private readonly chave: Buffer;

  public constructor(chaveHexadecimal: string) {
    this.chave = Buffer.from(chaveHexadecimal, 'hex');
    if (this.chave.length !== 32) {
      throw new Error('A chave de criptografia deve possuir 32 bytes');
    }
  }

  public criptografar(valor: string): string {
    return criptografarPayload(valor, this.chave);
  }

  public descriptografar(payload: string): string {
    return descriptografarPayload(payload, this.chave);
  }
}

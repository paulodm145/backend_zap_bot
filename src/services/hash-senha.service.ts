import bcrypt from 'bcryptjs';

export class HashSenhaService {
  public async comparar(senha: string, hash: string): Promise<boolean> {
    return bcrypt.compare(senha, hash);
  }

  public async gerar(senha: string): Promise<string> {
    return bcrypt.hash(senha, 12);
  }
}

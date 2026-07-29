import type {
  UsuarioInterno,
  UsuarioInternoRepository,
} from '../contratos/usuario-interno.repository.js';

/**
 * Adaptador transitório para o scaffold.
 *
 * A implementação Prisma substituirá este repository quando o schema do
 * central_db for criado. Sem usuários cadastrados, o login sempre falha de
 * forma segura.
 */
export class UsuarioInternoMemoriaRepository implements UsuarioInternoRepository {
  public async buscarPorEmail(_email: string): Promise<UsuarioInterno | null> {
    void _email;
    return Promise.resolve(null);
  }

  public buscarPorPublicId(_publicId: string): Promise<UsuarioInterno | null> {
    void _publicId;
    return Promise.resolve(null);
  }

  public salvarTotp(
    _publicId: string,
    _segredoCriptografado: string,
    _habilitado: boolean,
  ): Promise<void> {
    void _publicId;
    void _segredoCriptografado;
    void _habilitado;
    return Promise.resolve();
  }
}

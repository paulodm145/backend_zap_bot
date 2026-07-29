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
}

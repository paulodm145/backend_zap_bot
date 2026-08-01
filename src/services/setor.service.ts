import type {
  AtualizarSetorEntrada,
  CriarSetorEntrada,
  ListarSetoresEntrada,
} from '../dtos/setor.dto.js';
import { ConflitoError, NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { SetorRepository } from '../repositories/setor.repository.js';

interface ContextoSetor {
  usuarioCentralPublicId: string;
  papel: 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE';
}

export class SetorService {
  public constructor(private readonly setores: SetorRepository) {}

  public listar(entrada: ListarSetoresEntrada, contexto: ContextoSetor) {
    return this.setores.listar(
      entrada,
      contexto.papel === 'ATENDENTE' ? contexto.usuarioCentralPublicId : undefined,
    );
  }

  public async buscar(publicId: string, contexto: ContextoSetor) {
    const setor = await this.setores.buscar(
      publicId,
      contexto.papel === 'ATENDENTE' ? contexto.usuarioCentralPublicId : undefined,
    );
    if (!setor) throw new NaoEncontradoError('Setor não encontrado');
    return setor;
  }

  public async criar(entrada: CriarSetorEntrada) {
    if (await this.setores.buscarPorNome(entrada.nome))
      throw new ConflitoError('Já existe um setor com esse nome');
    return this.setores.criar(entrada);
  }

  public async atualizar(publicId: string, entrada: AtualizarSetorEntrada) {
    if (entrada.nome && (await this.setores.buscarPorNome(entrada.nome, publicId)))
      throw new ConflitoError('Já existe um setor com esse nome');
    if ((await this.setores.atualizar(publicId, entrada)).count !== 1)
      throw new NaoEncontradoError('Setor não encontrado');
    const setor = await this.setores.buscar(publicId);
    if (!setor) throw new NaoEncontradoError('Setor não encontrado');
    return setor;
  }

  public async excluir(publicId: string): Promise<void> {
    if (!(await this.setores.buscar(publicId)))
      throw new NaoEncontradoError('Setor não encontrado');
    if (await this.setores.usadoEmFluxoPublicado(publicId))
      throw new ConflitoError('Setor utilizado por fluxo publicado');
    if ((await this.setores.contarConversasAtivas(publicId)) > 0)
      throw new ConflitoError('Setor possui conversas ativas');
    if (!(await this.setores.excluir(publicId)))
      throw new NaoEncontradoError('Setor não encontrado');
  }

  public async substituirSetoresUsuario(usuarioPublicId: string, setoresPublicIds: string[]) {
    const resultado = await this.setores.substituirSetoresUsuario(
      usuarioPublicId,
      setoresPublicIds,
    );
    if (!resultado) throw new NaoEncontradoError('Usuário não encontrado');
    if (!resultado.setores)
      throw new ValidacaoError('Um ou mais setores não existem ou estão inativos');
    return { setores: resultado.setores };
  }

  public async listarAtendentesElegiveis(setorPublicId: string) {
    if (!(await this.setores.buscar(setorPublicId)))
      throw new NaoEncontradoError('Setor não encontrado');
    return this.setores.listarAtendentesElegiveis(setorPublicId);
  }
}

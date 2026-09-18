import type {
  AtualizarContatoEntrada,
  CriarContatoEntrada,
  ListarContatosEntrada,
} from '../dtos/contato.dto.js';
import { ConflitoError, NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import { normalizarTelefone } from '../helpers/telefone.helper.js';
import type { ContatoRepository } from '../repositories/contato.repository.js';

export class ContatoService {
  public constructor(private readonly contatos: ContatoRepository) {}

  public listar(entrada: ListarContatosEntrada) {
    return this.contatos.listar(entrada);
  }

  public async buscar(publicId: string) {
    const contato = await this.contatos.buscar(publicId);
    if (!contato) throw new NaoEncontradoError('Contato não encontrado');
    return contato;
  }

  public async criar(entrada: CriarContatoEntrada) {
    const telefone = this.normalizarOuFalhar(entrada.telefone);
    await this.garantirTelefoneDisponivel(telefone);
    return this.contatos.criar({
      telefone,
      ...(entrada.nome === undefined ? {} : { nome: entrada.nome }),
      ...(entrada.atributos === undefined ? {} : { atributos: entrada.atributos }),
    });
  }

  public async atualizar(publicId: string, entrada: AtualizarContatoEntrada) {
    const telefone = entrada.telefone === undefined ? undefined : this.normalizarOuFalhar(entrada.telefone);
    if (telefone !== undefined) await this.garantirTelefoneDisponivel(telefone, publicId);
    if (
      (
        await this.contatos.atualizar(publicId, {
          ...(telefone === undefined ? {} : { telefone }),
          ...(entrada.nome === undefined ? {} : { nome: entrada.nome }),
          ...(entrada.atributos === undefined ? {} : { atributos: entrada.atributos }),
        })
      ).count !== 1
    )
      throw new NaoEncontradoError('Contato não encontrado');
    return this.buscar(publicId);
  }

  public async excluir(publicId: string): Promise<void> {
    if (!(await this.contatos.buscar(publicId))) throw new NaoEncontradoError('Contato não encontrado');
    if ((await this.contatos.contarConversasAtivas(publicId)) > 0)
      throw new ConflitoError('Contato possui conversas em andamento');
    if (!(await this.contatos.excluir(publicId))) throw new NaoEncontradoError('Contato não encontrado');
  }

  private normalizarOuFalhar(telefone: string): string {
    const normalizado = normalizarTelefone(telefone);
    if (!normalizado) throw new ValidacaoError('Telefone inválido');
    return normalizado;
  }

  private async garantirTelefoneDisponivel(telefone: string, ignorarPublicId?: string): Promise<void> {
    const existente = await this.contatos.buscarPorTelefone(telefone, ignorarPublicId);
    if (existente)
      throw new ConflitoError(
        `Já existe um contato com esse telefone${existente.nome ? `: ${existente.nome}` : ''}`,
      );
  }
}

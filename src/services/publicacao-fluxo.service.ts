import { definicaoFluxoSchema } from '../dtos/fluxo.dto.js';
import { ConflitoError, NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { FluxoRepository } from '../repositories/fluxo.repository.js';
import type { ValidacaoGrafoFluxoService } from './validacao-grafo-fluxo.service.js';

export class PublicacaoFluxoService {
  public constructor(
    private readonly fluxos: FluxoRepository,
    private readonly validador: ValidacaoGrafoFluxoService,
  ) {}

  public async publicar(publicId: string) {
    const fluxo = await this.fluxos.buscarPorPublicId(publicId);
    if (!fluxo) throw new NaoEncontradoError('Fluxo não encontrado');
    if (!fluxo.possui_alteracoes_nao_publicadas) {
      throw new ConflitoError('O fluxo não possui alterações para publicar');
    }

    const definicao = definicaoFluxoSchema.parse(fluxo.definicao);
    const erros = await this.validador.validar(definicao);
    if (erros.length > 0) {
      throw new ValidacaoError('O grafo do fluxo é inválido', { erros });
    }

    return this.fluxos.publicar(fluxo.id, definicao, fluxo.versao + 1);
  }
}

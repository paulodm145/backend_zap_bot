import { definicaoFluxoSchema } from '../dtos/fluxo.dto.js';
import { NaoEncontradoError } from '../erros/erro-aplicacao.js';
import type { EstadoFluxoRepository } from '../repositories/estado-fluxo-redis.repository.js';
import type { MotorFluxoService } from './motor-fluxo.service.js';

interface LeitorVersaoFluxo {
  buscarVersaoPorPublicId(publicId: string): Promise<{
    public_id: string;
    definicao: unknown;
  } | null>;
  buscarVersaoPublicada(publicId: string): Promise<{
    versoes: { public_id: string; definicao: unknown }[];
  } | null>;
}

export class ExecucaoFluxoService {
  public constructor(
    private readonly fluxos: LeitorVersaoFluxo,
    private readonly estados: EstadoFluxoRepository,
    private readonly motor: MotorFluxoService,
  ) {}

  public async executarConversa(entrada: {
    tenantId: string;
    conversaId: string;
    fluxoId: string;
    mensagem?: string;
    maxPassos?: number;
  }) {
    const estado = await this.estados.carregar(entrada.tenantId, entrada.conversaId);
    const versao = estado
      ? await this.fluxos.buscarVersaoPorPublicId(estado.fluxoVersaoId)
      : (await this.fluxos.buscarVersaoPublicada(entrada.fluxoId))?.versoes[0];
    if (!versao) throw new NaoEncontradoError('Versão publicada do fluxo não encontrada');

    const resultado = this.motor.executar({
      definicao: definicaoFluxoSchema.parse(versao.definicao),
      fluxoVersaoId: versao.public_id,
      ...(estado ? { estado } : {}),
      ...(entrada.mensagem === undefined ? {} : { mensagem: entrada.mensagem }),
      maxPassos: entrada.maxPassos ?? 50,
    });
    await this.estados.salvar(entrada.tenantId, entrada.conversaId, resultado.estado);
    return resultado;
  }
}

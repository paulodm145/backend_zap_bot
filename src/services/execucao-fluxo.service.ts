import { definicaoFluxoSchema, type EstadoConversaFluxo } from '../dtos/fluxo.dto.js';
import { NaoEncontradoError } from '../erros/erro-aplicacao.js';
import type { EstadoFluxoRepository } from '../repositories/estado-fluxo-redis.repository.js';
import type { MotorFluxoService } from './motor-fluxo.service.js';
import { barramentoChat } from '../eventos/barramento-chat.js';

interface LeitorVersaoFluxo {
  buscarVersaoPorPublicId(publicId: string): Promise<{
    public_id: string;
    definicao: unknown;
  } | null>;
  buscarVersaoPublicada(publicId: string): Promise<{
    versoes: { public_id: string; definicao: unknown }[];
  } | null>;
}

interface PersistidorDirecionamento {
  direcionarPeloFluxo(
    conversaPublicId: string,
    setorPublicId: string,
    estadoFluxo: EstadoConversaFluxo,
  ): Promise<boolean>;
}

export class ExecucaoFluxoService {
  public constructor(
    private readonly fluxos: LeitorVersaoFluxo,
    private readonly estados: EstadoFluxoRepository,
    private readonly motor: MotorFluxoService,
    private readonly direcionamentos?: PersistidorDirecionamento,
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
    for (const saida of resultado.saidas) {
      if (saida.tipo === 'direcionamento' && this.direcionamentos) {
        await this.direcionamentos.direcionarPeloFluxo(
          entrada.conversaId,
          saida.setorId,
          resultado.estado,
        );
        barramentoChat.publicar('conversa:nova_na_fila', {
          tenantId: entrada.tenantId,
          conversaId: entrada.conversaId,
          setorId: saida.setorId,
        });
      }
    }
    return resultado;
  }
}

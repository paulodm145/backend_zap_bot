import {
  autenticacaoIntegracaoSchema,
  type AutenticacaoIntegracao,
} from '../dtos/credencial-integracao.dto.js';
import {
  definicaoFluxoSchema,
  type EstadoConversaFluxo,
  type NoIntegracaoHttp,
} from '../dtos/fluxo.dto.js';
import { NaoEncontradoError } from '../erros/erro-aplicacao.js';
import { extrairCaminho } from '../helpers/extracao-json.helper.js';
import { interpolarTemplate } from '../helpers/template-fluxo.helper.js';
import type { EstadoFluxoRepository } from '../repositories/estado-fluxo-redis.repository.js';
import type { CriptografiaService } from './criptografia.service.js';
import type { IntegracaoHttpService } from './integracao-http.service.js';
import type {
  MotorFluxoService,
  ResultadoIntegracaoFluxo,
  SaidaExecucaoFluxo,
} from './motor-fluxo.service.js';
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

interface LeitorCredencialIntegracao {
  buscarConfiguracao(publicId: string): Promise<{
    public_id: string;
    base_url: string;
    configuracao_encrypted: string;
  } | null>;
}

export interface DependenciasIntegracaoFluxo {
  credenciais: LeitorCredencialIntegracao;
  http: IntegracaoHttpService;
  criptografia: CriptografiaService;
}

/** Teto de chamadas externas por execução, para um grafo encadeado não virar rajada. */
const MAXIMO_INTEGRACOES_POR_EXECUCAO = 5;

export class ExecucaoFluxoService {
  public constructor(
    private readonly fluxos: LeitorVersaoFluxo,
    private readonly estados: EstadoFluxoRepository,
    private readonly motor: MotorFluxoService,
    private readonly direcionamentos?: PersistidorDirecionamento,
    private readonly integracoes?: DependenciasIntegracaoFluxo,
  ) {}

  public async executarConversa(entrada: {
    tenantId: string;
    conversaId: string;
    fluxoId: string;
    mensagem?: string;
    maxPassos?: number;
  }) {
    const estadoInicial = await this.estados.carregar(entrada.tenantId, entrada.conversaId);
    const versao = estadoInicial
      ? await this.fluxos.buscarVersaoPorPublicId(estadoInicial.fluxoVersaoId)
      : (await this.fluxos.buscarVersaoPublicada(entrada.fluxoId))?.versoes[0];
    if (!versao) throw new NaoEncontradoError('Versão publicada do fluxo não encontrada');

    const definicao = definicaoFluxoSchema.parse(versao.definicao);
    const maxPassos = entrada.maxPassos ?? 50;
    let resultado = this.motor.executar({
      definicao,
      fluxoVersaoId: versao.public_id,
      ...(estadoInicial ? { estado: estadoInicial } : {}),
      ...(entrada.mensagem === undefined ? {} : { mensagem: entrada.mensagem }),
      maxPassos,
    });
    const saidas: SaidaExecucaoFluxo[] = [...resultado.saidas];

    // O motor pausa em cada nó de integração; aqui a chamada acontece e o
    // motor é reentrado com o resultado, até o fluxo seguir sem pendência.
    for (let chamada = 0; chamada < MAXIMO_INTEGRACOES_POR_EXECUCAO; chamada += 1) {
      const pendente = resultado.saidas.find((saida) => saida.tipo === 'integracao');
      if (!pendente) break;
      const resultadoIntegracao = await this.executarIntegracao(pendente.no, resultado.estado);
      resultado = this.motor.executar({
        definicao,
        fluxoVersaoId: versao.public_id,
        estado: resultado.estado,
        resultadoIntegracao,
        maxPassos,
      });
      saidas.push(...resultado.saidas);
    }

    await this.estados.salvar(entrada.tenantId, entrada.conversaId, resultado.estado);
    for (const saida of saidas) {
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
    return { estado: resultado.estado, saidas };
  }

  private async executarIntegracao(
    no: NoIntegracaoHttp,
    estado: EstadoConversaFluxo,
  ): Promise<ResultadoIntegracaoFluxo> {
    const falha: ResultadoIntegracaoFluxo = { noId: no.id, sucesso: false, variaveis: {} };
    if (!this.integracoes) return falha;

    const credencial = await this.integracoes.credenciais.buscarConfiguracao(no.dados.credencialId);
    if (!credencial) return falha;

    const url = interpolarTemplate(no.dados.url, estado.variaveis);
    if (!url.completo) return falha;
    const corpo =
      no.dados.corpo === undefined
        ? undefined
        : interpolarTemplate(no.dados.corpo, estado.variaveis);
    if (corpo && !corpo.completo) return falha;

    const autenticacao = this.lerAutenticacao(credencial.configuracao_encrypted);
    if (!autenticacao) return falha;

    const resposta = await this.integracoes.http.executar({
      metodo: no.dados.metodo,
      url: url.texto,
      baseUrlAutorizada: credencial.base_url,
      autenticacao,
      ...(corpo?.completo ? { corpo: corpo.texto } : {}),
    });
    if (!resposta.sucesso) return falha;

    const variaveis: Record<string, string> = {};
    for (const [variavel, caminho] of Object.entries(no.dados.mapeamentoResposta)) {
      const extraido = extrairCaminho(resposta.corpo, caminho);
      if (extraido.encontrado) variaveis[variavel] = extraido.valor;
    }
    return { noId: no.id, sucesso: true, variaveis };
  }

  private lerAutenticacao(configuracaoEncrypted: string): AutenticacaoIntegracao | null {
    try {
      const conteudo: unknown = JSON.parse(
        this.integracoes?.criptografia.descriptografar(configuracaoEncrypted) ?? '',
      );
      const autenticacao = autenticacaoIntegracaoSchema.safeParse(conteudo);
      return autenticacao.success ? autenticacao.data : null;
    } catch {
      return null;
    }
  }
}

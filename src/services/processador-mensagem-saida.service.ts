import type { GerenciadorConexoesTenant } from '../database/gerenciador-conexoes-tenant.js';
import { MensagemAtendimentoRepository } from '../repositories/mensagem-atendimento.repository.js';
import type { TenantCentralRepository } from '../repositories/tenant-central.repository.js';
import type { JobMensagemSaida } from '../types/jobs.js';
import type { CriptografiaService } from './criptografia.service.js';
import { ErroEnvioWhatsapp, type WhatsappGraphApiService } from './whatsapp-graph-api.service.js';

export class ProcessadorMensagemSaidaService {
  public constructor(
    private readonly tenants: TenantCentralRepository,
    private readonly criptografiaConexao: CriptografiaService,
    private readonly criptografiaWhatsapp: CriptografiaService,
    private readonly conexoes: GerenciadorConexoesTenant,
    private readonly graphApi: WhatsappGraphApiService,
  ) {}

  public async processar(job: JobMensagemSaida): Promise<'ENVIADA' | 'JA_PROCESSADA' | 'FALHA'> {
    const tenant = await this.tenants.buscarPorPublicId(job.tenantId);
    if (!tenant?.string_conexao_encrypted || tenant.status !== 'ATIVO')
      throw new Error('Tenant indisponível para envio');
    const prisma = await this.conexoes.obter(
      tenant.id,
      this.criptografiaConexao.descriptografar(tenant.string_conexao_encrypted),
    );
    const repositorio = new MensagemAtendimentoRepository(prisma);
    const mensagem = await repositorio.buscarParaEnvio(job.mensagemPublicId);
    if (!mensagem) throw new Error('Mensagem de saída não encontrada');
    if (mensagem.status_entrega !== 'PENDENTE') return 'JA_PROCESSADA';
    const tentativa = await repositorio.marcarTentativa(mensagem.public_id);
    if (tentativa.count === 0) return 'JA_PROCESSADA';
    const conta = mensagem.conversa.conta_whatsapp;
    try {
      const metaId = await this.graphApi.enviar(
        conta.phone_number_id,
        conta.versao_graph_api,
        this.criptografiaWhatsapp.descriptografar(conta.token_encrypted),
        {
          destinatario: mensagem.conversa.contato.telefone,
          tipo: mensagem.tipo === 'SISTEMA' ? 'TEXTO' : mensagem.tipo,
          ...(typeof mensagem.conteudo === 'object' &&
          mensagem.conteudo !== null &&
          'texto' in mensagem.conteudo &&
          typeof mensagem.conteudo.texto === 'string'
            ? { texto: mensagem.conteudo.texto }
            : {}),
          ...(mensagem.midia_url ? { midiaUrl: mensagem.midia_url } : {}),
          ...(mensagem.midia_nome ? { midiaNome: mensagem.midia_nome } : {}),
        },
      );
      await repositorio.marcarEnviada(mensagem.public_id, metaId);
      return 'ENVIADA';
    } catch (erro: unknown) {
      if (erro instanceof ErroEnvioWhatsapp && !erro.transitorio) {
        await repositorio.marcarFalha(mensagem.public_id, erro.codigo);
        return 'FALHA';
      }
      await repositorio.liberarTentativa(mensagem.public_id);
      throw erro;
    }
  }
}

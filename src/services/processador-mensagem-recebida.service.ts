import type { GerenciadorConexoesTenant } from '../database/gerenciador-conexoes-tenant.js';
import { converterTimestampUnixWhatsapp } from '../helpers/timestamp-whatsapp.helper.js';
import { DirecionamentoAtendimentoRepository } from '../repositories/direcionamento-atendimento.repository.js';
import { FluxoRepository } from '../repositories/fluxo.repository.js';
import { HistoricoRepository } from '../repositories/historico.repository.js';
import type { TenantCentralRepository } from '../repositories/tenant-central.repository.js';
import type { JobMensagemRecebida } from '../types/jobs.js';
import type { CriptografiaService } from './criptografia.service.js';
import type { EstadoFluxoRepository } from '../repositories/estado-fluxo-redis.repository.js';
import { CredencialIntegracaoRepository } from '../repositories/credencial-integracao.repository.js';
import { ExecucaoFluxoService } from './execucao-fluxo.service.js';
import type { IntegracaoHttpService } from './integracao-http.service.js';
import type { MotorFluxoService } from './motor-fluxo.service.js';
import type { EnfileiradorMensagemSaida } from './mensagem-atendimento.service.js';
import { barramentoChat } from '../eventos/barramento-chat.js';

export class ProcessadorMensagemRecebidaService {
  public constructor(
    private readonly tenants: TenantCentralRepository,
    private readonly criptografia: CriptografiaService,
    private readonly conexoes: GerenciadorConexoesTenant,
    private readonly estadosFluxo: EstadoFluxoRepository,
    private readonly motor: MotorFluxoService,
    private readonly enfileiradorSaida: EnfileiradorMensagemSaida,
    private readonly integracoes?: {
      http: IntegracaoHttpService;
      criptografia: CriptografiaService;
    },
  ) {}

  public async processar(job: JobMensagemRecebida): Promise<'CRIADA' | 'DUPLICADA'> {
    const tenant = await this.tenants.buscarPorPublicId(job.tenantId);
    if (!tenant?.string_conexao_encrypted || tenant.status !== 'ATIVO')
      throw new Error('Tenant indisponível para processar mensagem');
    const ocorreuAt = converterTimestampUnixWhatsapp(job.timestamp);
    if (!ocorreuAt) throw new Error('Timestamp da mensagem inválido');
    const prisma = await this.conexoes.obter(
      tenant.id,
      this.criptografia.descriptografar(tenant.string_conexao_encrypted),
    );
    const resultado = await new HistoricoRepository(prisma).persistirRecebida(job, ocorreuAt);
    if (resultado !== 'CRIADA') return resultado;

    const mensagem = await prisma.mensagem.findUnique({
      where: { whatsapp_message_id: job.mensagemId },
      select: {
        public_id: true,
        conversa: {
          select: {
            id: true,
            public_id: true,
            status: true,
            setor: { select: { public_id: true } },
            conta_whatsapp: { select: { fluxo: { select: { public_id: true, ativo: true } } } },
          },
        },
      },
    });
    if (!mensagem) return resultado;

    barramentoChat.publicar('conversa:mensagem_recebida', {
      tenantId: job.tenantId,
      conversaId: mensagem.conversa.public_id,
      mensagemId: mensagem.public_id,
      ...(mensagem.conversa.setor ? { setorId: mensagem.conversa.setor.public_id } : {}),
    });

    const fluxo = mensagem.conversa.conta_whatsapp.fluxo;
    if (mensagem.conversa.status === 'BOT' && fluxo?.ativo) {
      await this.executarFluxo(
        prisma,
        job,
        mensagem.conversa.id,
        mensagem.conversa.public_id,
        fluxo.public_id,
      );
    }

    return resultado;
  }

  private async executarFluxo(
    prisma: Awaited<ReturnType<GerenciadorConexoesTenant['obter']>>,
    job: JobMensagemRecebida,
    conversaId: number,
    conversaPublicId: string,
    fluxoPublicoId: string,
  ): Promise<void> {
    const execucao = new ExecucaoFluxoService(
      new FluxoRepository(prisma),
      this.estadosFluxo,
      this.motor,
      new DirecionamentoAtendimentoRepository(prisma),
      this.integracoes
        ? {
            credenciais: new CredencialIntegracaoRepository(prisma),
            http: this.integracoes.http,
            criptografia: this.integracoes.criptografia,
          }
        : undefined,
    );
    const resultado = await execucao.executarConversa({
      tenantId: job.tenantId,
      conversaId: conversaPublicId,
      fluxoId: fluxoPublicoId,
      mensagem: job.texto,
    });

    const historico = new HistoricoRepository(prisma);
    for (const saida of resultado.saidas) {
      const texto =
        saida.tipo === 'mensagem'
          ? saida.texto
          : saida.tipo === 'captura'
            ? saida.mensagem
            : undefined;
      if (texto === undefined) continue;
      const bot = await historico.criarMensagemBot(conversaId, texto);
      await this.enfileiradorSaida.adicionar(job.tenantId, bot.public_id);
      barramentoChat.publicar('conversa:mensagem_atualizada', {
        tenantId: job.tenantId,
        conversaId: conversaPublicId,
        mensagemId: bot.public_id,
        dados: { status: 'PENDENTE' },
      });
    }
  }
}

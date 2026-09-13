import type { GerenciadorConexoesTenant } from '../database/gerenciador-conexoes-tenant.js';
import {
  dadosConexaoWhatsappSchema,
  dadosMensagemWhatsappSchema,
  type WebhookEvolutionEntrada,
} from '../dtos/webhook-whatsapp.dto.js';
import { AcessoNegadoError, NaoEncontradoError } from '../erros/erro-aplicacao.js';
import { criarChaveIdempotenciaMensagem } from '../helpers/chave-redis.helper.js';
import { ContaWhatsappRepository } from '../repositories/conta-whatsapp.repository.js';
import type { CriptografiaService } from './criptografia.service.js';
import type { EnfileiradorMensagem } from './enfileirador-mensagem.service.js';

interface RoteamentoWhatsapp {
  buscarTenantAtivo(instanceName: string): Promise<{
    tenant: {
      id: number;
      public_id: string;
      status: string;
      string_conexao_encrypted: string | null;
      deletado_at: Date | null;
    };
  } | null>;
}

interface RepositorioIdempotencia {
  reservar(chave: string, expiracaoSegundos: number): Promise<boolean>;
  liberar(chave: string): Promise<void>;
}

export interface ResultadoWebhookWhatsapp {
  processado: boolean;
  recebidas: number;
  duplicadas: number;
}

const STATUS_POR_ESTADO = {
  open: 'CONECTADO',
  connecting: 'CONECTANDO',
  close: 'DESCONECTADO',
} as const;

export class WebhookWhatsappService {
  public constructor(
    private readonly roteamentos: RoteamentoWhatsapp,
    private readonly conexoes: GerenciadorConexoesTenant,
    private readonly criptografiaConexao: CriptografiaService,
    private readonly criptografiaWhatsapp: CriptografiaService,
    private readonly idempotencia: RepositorioIdempotencia,
    private readonly enfileirador: EnfileiradorMensagem,
    private readonly expiracaoIdempotenciaSegundos: number,
  ) {}

  public async receber(entrada: WebhookEvolutionEntrada): Promise<ResultadoWebhookWhatsapp> {
    const roteamento = await this.roteamentos.buscarTenantAtivo(entrada.instance);
    const tenant = roteamento?.tenant;
    if (!tenant) {
      throw new NaoEncontradoError('Conta WhatsApp ativa não encontrada');
    }
    if (
      tenant.status !== 'ATIVO' ||
      tenant.deletado_at !== null ||
      !tenant.string_conexao_encrypted
    ) {
      throw new NaoEncontradoError('Conta WhatsApp ativa não encontrada');
    }

    const prisma = await this.conexoes.obter(
      tenant.id,
      this.criptografiaConexao.descriptografar(tenant.string_conexao_encrypted),
    );
    const contas = new ContaWhatsappRepository(prisma);
    const conta = await contas.buscarPorInstancia(entrada.instance, true);
    if (!conta) throw new NaoEncontradoError('Conta WhatsApp ativa não encontrada');

    const apiKeyEsperada = this.criptografiaWhatsapp.descriptografar(conta.api_key_encrypted);
    if (apiKeyEsperada !== entrada.apikey) {
      throw new AcessoNegadoError('Origem do webhook não confere com a instância');
    }

    if (entrada.event === 'connection.update') {
      const dados = dadosConexaoWhatsappSchema.safeParse(entrada.data);
      if (dados.success) {
        await contas.registrarEstadoConexao(conta.id, {
          status: STATUS_POR_ESTADO[dados.data.state],
        });
      }
      return { processado: true, recebidas: 0, duplicadas: 0 };
    }

    if (entrada.event === 'messages.upsert') {
      const dados = dadosMensagemWhatsappSchema.safeParse(entrada.data);
      const texto = dados.success
        ? (dados.data.message?.conversation ?? dados.data.message?.extendedTextMessage?.text)
        : undefined;
      if (!dados.success || dados.data.key.fromMe || texto === undefined) {
        return { processado: true, recebidas: 0, duplicadas: 0 };
      }

      const chave = criarChaveIdempotenciaMensagem(tenant.public_id, dados.data.key.id);
      const reservada = await this.idempotencia.reservar(chave, this.expiracaoIdempotenciaSegundos);
      if (!reservada) {
        return { processado: true, recebidas: 0, duplicadas: 1 };
      }

      try {
        await this.enfileirador.adicionar(
          {
            tenantId: tenant.public_id,
            instanceName: entrada.instance,
            mensagemId: dados.data.key.id,
            remetente: dados.data.key.remoteJid,
            timestamp: String(dados.data.messageTimestamp),
            tipo: 'text',
            texto,
          },
          chave,
        );
      } catch (erro) {
        await this.idempotencia.liberar(chave);
        throw erro;
      }
      return { processado: true, recebidas: 1, duplicadas: 0 };
    }

    return { processado: false, recebidas: 0, duplicadas: 0 };
  }
}

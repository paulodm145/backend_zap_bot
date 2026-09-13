import { randomUUID } from 'node:crypto';

import type {
  AtualizarContaWhatsappEntrada,
  CriarContaWhatsappEntrada,
} from '../dtos/conta-whatsapp.dto.js';
import { ConflitoError, NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { ContaWhatsappRepository } from '../repositories/conta-whatsapp.repository.js';
import type { RoteamentoWhatsappRepository } from '../repositories/roteamento-whatsapp.repository.js';
import type { CriptografiaService } from './criptografia.service.js';
import { ErroEvolutionApi, type EvolutionApiService } from './evolution-api.service.js';

interface ContextoContaWhatsapp {
  tenantId: number;
  autorUsuarioId: string;
}

export class ContaWhatsappService {
  public constructor(
    private readonly contas: ContaWhatsappRepository,
    private readonly roteamentos: RoteamentoWhatsappRepository,
    private readonly criptografia: CriptografiaService,
    private readonly evolution: EvolutionApiService,
  ) {}

  public async criar(entrada: CriarContaWhatsappEntrada, contexto: ContextoContaWhatsapp) {
    const limite = await this.roteamentos.obterLimiteDoTenant(contexto.tenantId);
    if ((await this.contas.contarAtivas()) >= limite) {
      throw new ValidacaoError(`O plano permite no máximo ${String(limite)} conta(s) WhatsApp`);
    }

    const instanceName = this.gerarNomeInstancia(contexto.tenantId);
    await this.validarPropriedadeRoteamento(instanceName, contexto.tenantId);

    let instancia;
    try {
      instancia = await this.evolution.criarInstancia(instanceName);
    } catch (erro: unknown) {
      if (erro instanceof ErroEvolutionApi) {
        throw new ValidacaoError('Não foi possível criar a instância na Evolution API');
      }
      throw erro;
    }

    const conta = await this.contas.criar({
      nome: entrada.nome,
      instanceName,
      instanceId: instancia.instanceId,
      apiKeyEncrypted: this.criptografia.criptografar(instancia.apiKey),
      autorUsuarioId: contexto.autorUsuarioId,
    });

    try {
      await this.roteamentos.sincronizar(contexto.tenantId, instanceName);
    } catch (erro: unknown) {
      await this.contas.excluirCriacaoCompensatoria(conta.id);
      await this.evolution.excluirInstancia(instanceName, instancia.apiKey).catch(() => undefined);
      throw erro;
    }

    return { conta: this.segura(conta), qrCodeBase64: instancia.qrCodeBase64 };
  }

  public async atualizar(
    publicId: string,
    entrada: AtualizarContaWhatsappEntrada,
    contexto: ContextoContaWhatsapp,
  ) {
    const resultado = await this.contas.atualizar(publicId, entrada.nome, contexto.autorUsuarioId);
    if (!resultado) throw new NaoEncontradoError('Conta WhatsApp não encontrada');
    return resultado;
  }

  public async reconectar(publicId: string) {
    const conta = await this.contas.buscar(publicId, true);
    if (!conta) throw new NaoEncontradoError('Conta WhatsApp não encontrada');
    const apiKey = this.criptografia.descriptografar(conta.api_key_encrypted);
    const { qrCodeBase64 } = await this.evolution.reconectar(conta.instance_name, apiKey);
    return { conta: this.segura(conta), qrCodeBase64 };
  }

  public async desconectar(publicId: string) {
    const conta = await this.contas.buscar(publicId, true);
    if (!conta) throw new NaoEncontradoError('Conta WhatsApp não encontrada');
    const apiKey = this.criptografia.descriptografar(conta.api_key_encrypted);
    await this.evolution.desconectar(conta.instance_name, apiKey);
    return this.contas.registrarEstadoConexao(conta.id, { status: 'DESCONECTADO' });
  }

  public async alterarAtivo(publicId: string, ativo: boolean, contexto: ContextoContaWhatsapp) {
    const atual = await this.contas.buscar(publicId, true);
    if (!atual) throw new NaoEncontradoError('Conta WhatsApp não encontrada');
    if (ativo && !atual.ativo) {
      const limite = await this.roteamentos.obterLimiteDoTenant(contexto.tenantId);
      if ((await this.contas.contarAtivas()) >= limite) {
        throw new ValidacaoError(`O plano permite no máximo ${String(limite)} conta(s) WhatsApp`);
      }
    }
    const conta = await this.contas.alterarAtivo(publicId, ativo, contexto.autorUsuarioId);
    if (!conta) throw new NaoEncontradoError('Conta WhatsApp não encontrada');
    if (!ativo) {
      const apiKey = this.criptografia.descriptografar(atual.api_key_encrypted);
      await this.evolution.desconectar(atual.instance_name, apiKey).catch(() => undefined);
    }
    return this.segura(conta);
  }

  private gerarNomeInstancia(tenantId: number): string {
    return `tenant-${String(tenantId)}-${randomUUID()}`;
  }

  private async validarPropriedadeRoteamento(instanceName: string, tenantId: number) {
    const existente = await this.roteamentos.buscar(instanceName);
    if (existente && existente.tenant_id !== tenantId) {
      throw new ConflitoError('Esta instância já pertence a outro tenant');
    }
  }

  private segura<T extends { api_key_encrypted: string }>(conta: T): Omit<T, 'api_key_encrypted'> {
    const { api_key_encrypted: _segredo, ...segura } = conta;
    void _segredo;
    return segura;
  }
}

import type {
  AtualizarContaWhatsappEntrada,
  CriarContaWhatsappEntrada,
} from '../dtos/conta-whatsapp.dto.js';
import { ConflitoError, NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { ContaWhatsappRepository } from '../repositories/conta-whatsapp.repository.js';
import type { RoteamentoWhatsappRepository } from '../repositories/roteamento-whatsapp.repository.js';
import type { CriptografiaService } from './criptografia.service.js';
import type { WhatsappGraphApiService } from './whatsapp-graph-api.service.js';

interface ContextoContaWhatsapp {
  tenantId: number;
  autorUsuarioId: string;
}

export class ContaWhatsappService {
  public constructor(
    private readonly contas: ContaWhatsappRepository,
    private readonly roteamentos: RoteamentoWhatsappRepository,
    private readonly criptografia: CriptografiaService,
    private readonly graphApi: WhatsappGraphApiService,
  ) {}

  public async criar(entrada: CriarContaWhatsappEntrada, contexto: ContextoContaWhatsapp) {
    const limite = await this.roteamentos.obterLimiteDoTenant(contexto.tenantId);
    if ((await this.contas.contarAtivas()) >= limite) {
      throw new ValidacaoError(`O plano permite no máximo ${String(limite)} conta(s) WhatsApp`);
    }
    await this.validarPropriedadeRoteamento(entrada.phoneNumberId, contexto.tenantId);
    const conta = await this.contas.criar({
      nome: entrada.nome,
      phoneNumberId: entrada.phoneNumberId,
      wabaId: entrada.wabaId,
      ...(entrada.numeroExibicao ? { numeroExibicao: entrada.numeroExibicao } : {}),
      versaoGraphApi: entrada.versaoGraphApi,
      tokenEncrypted: this.criptografia.criptografar(entrada.accessToken),
      autorUsuarioId: contexto.autorUsuarioId,
    });
    try {
      await this.roteamentos.sincronizar(contexto.tenantId, conta.phone_number_id);
    } catch (erro: unknown) {
      await this.contas.excluirCriacaoCompensatoria(conta.id);
      throw erro;
    }
    return this.segura(conta);
  }

  public async atualizar(
    publicId: string,
    entrada: AtualizarContaWhatsappEntrada,
    contexto: ContextoContaWhatsapp,
  ) {
    const atual = await this.contas.buscar(publicId, true);
    if (!atual) throw new NaoEncontradoError('Conta WhatsApp não encontrada');
    const novoPhoneNumberId = entrada.phoneNumberId ?? atual.phone_number_id;
    await this.validarPropriedadeRoteamento(novoPhoneNumberId, contexto.tenantId);
    const resultado = await this.contas.atualizar(publicId, entrada, contexto.autorUsuarioId);
    if (!resultado) throw new NaoEncontradoError('Conta WhatsApp não encontrada');
    try {
      await this.roteamentos.sincronizar(contexto.tenantId, novoPhoneNumberId);
      if (atual.phone_number_id !== novoPhoneNumberId) {
        await this.roteamentos.remover(contexto.tenantId, atual.phone_number_id);
      }
    } catch (erro: unknown) {
      await this.contas.atualizar(
        publicId,
        {
          nome: resultado.anterior.nome,
          phoneNumberId: resultado.anterior.phone_number_id,
          wabaId: resultado.anterior.waba_id,
          numeroExibicao: resultado.anterior.numero_exibicao,
          versaoGraphApi: resultado.anterior.versao_graph_api,
        },
        contexto.autorUsuarioId,
      );
      throw erro;
    }
    return this.segura(resultado.conta);
  }

  public async rotacionarToken(publicId: string, accessToken: string, autorUsuarioId: string) {
    const conta = await this.contas.alterarToken(
      publicId,
      this.criptografia.criptografar(accessToken),
      autorUsuarioId,
    );
    if (!conta) throw new NaoEncontradoError('Conta WhatsApp não encontrada');
    return this.segura(conta);
  }

  public async alterarAtivo(publicId: string, ativo: boolean, contexto: ContextoContaWhatsapp) {
    const atual = await this.contas.buscar(publicId, true);
    if (!atual) throw new NaoEncontradoError('Conta WhatsApp não encontrada');
    if (ativo && !atual.ativo) {
      const limite = await this.roteamentos.obterLimiteDoTenant(contexto.tenantId);
      if ((await this.contas.contarAtivas()) >= limite) {
        throw new ValidacaoError(`O plano permite no máximo ${String(limite)} conta(s) WhatsApp`);
      }
      await this.validarPropriedadeRoteamento(atual.phone_number_id, contexto.tenantId);
    }
    const conta = await this.contas.alterarAtivo(publicId, ativo, contexto.autorUsuarioId);
    if (!conta) throw new NaoEncontradoError('Conta WhatsApp não encontrada');
    if (ativo) await this.roteamentos.sincronizar(contexto.tenantId, conta.phone_number_id);
    else await this.roteamentos.remover(contexto.tenantId, conta.phone_number_id);
    return this.segura(conta);
  }

  public async testar(publicId: string) {
    const conta = await this.contas.buscar(publicId, true);
    if (!conta) throw new NaoEncontradoError('Conta WhatsApp não encontrada');
    const resultado = await this.graphApi.validar(
      conta.phone_number_id,
      conta.versao_graph_api,
      this.criptografia.descriptografar(conta.token_encrypted),
    );
    return this.contas.registrarValidacao(conta.id, resultado);
  }

  private async validarPropriedadeRoteamento(phoneNumberId: string, tenantId: number) {
    const existente = await this.roteamentos.buscar(phoneNumberId);
    if (existente && existente.tenant_id !== tenantId) {
      throw new ConflitoError('Este phone_number_id já pertence a outro tenant');
    }
  }

  private segura<T extends { token_encrypted: string }>(conta: T): Omit<T, 'token_encrypted'> {
    const { token_encrypted: _segredo, ...segura } = conta;
    void _segredo;
    return segura;
  }
}

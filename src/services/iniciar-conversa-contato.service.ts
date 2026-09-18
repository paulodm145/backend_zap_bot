import type { IniciarConversaContatoEntrada } from '../dtos/contato.dto.js';
import { AcessoNegadoError, ConflitoError, NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import type { ContaWhatsappRepository } from '../repositories/conta-whatsapp.repository.js';
import type { ContatoRepository } from '../repositories/contato.repository.js';
import type { DirecionamentoAtendimentoRepository } from '../repositories/direcionamento-atendimento.repository.js';
import { barramentoChat } from '../eventos/barramento-chat.js';

interface ContextoIniciarConversa {
  usuarioCentralPublicId: string;
  tenantId: string;
}

/**
 * Ponte entre o cadastro de contatos e o atendimento: reivindica ou cria a conversa
 * do contato e devolve o id para o frontend abrir o chat. Não envia mensagem — quem
 * envia continua sendo o fluxo já existente de `POST /conversas/:id/mensagens`, com
 * as mesmas regras de janela de atendimento de sempre.
 */
export class IniciarConversaContatoService {
  public constructor(
    private readonly contatos: ContatoRepository,
    private readonly contasWhatsapp: ContaWhatsappRepository,
    private readonly direcionamento: DirecionamentoAtendimentoRepository,
  ) {}

  public async iniciar(
    contatoPublicId: string,
    entrada: IniciarConversaContatoEntrada,
    contexto: ContextoIniciarConversa,
  ) {
    const [contato, atendente] = await Promise.all([
      this.contatos.buscarIdAtivo(contatoPublicId),
      this.direcionamento.buscarAtendente(contexto.usuarioCentralPublicId),
    ]);
    if (!contato) throw new NaoEncontradoError('Contato não encontrado');
    if (!atendente) throw new AcessoNegadoError('Usuário não possui perfil de atendente ativo');
    const conta = await this.resolverContaWhatsapp(entrada.contaWhatsappId);
    const resultado = await this.direcionamento.iniciarContatoDireto(
      contato.id,
      conta.id,
      atendente.id,
      contexto.usuarioCentralPublicId,
    );
    if (resultado === 'CONFLITO')
      throw new ConflitoError('Conversa com este contato já está sendo atendida por outra pessoa');
    barramentoChat.publicar('conversa:assumida', {
      tenantId: contexto.tenantId,
      conversaId: resultado.public_id,
      dados: { atendenteId: atendente.public_id },
    });
    return {
      conversaId: resultado.public_id,
      status: resultado.status,
      janelaAberta: !!resultado.janela_expira_at && resultado.janela_expira_at > new Date(),
    };
  }

  private async resolverContaWhatsapp(contaWhatsappId?: string) {
    if (contaWhatsappId) {
      const conta = await this.contasWhatsapp.buscarConectada(contaWhatsappId);
      if (!conta) throw new ValidacaoError('Conta WhatsApp indisponível ou desconectada');
      return conta;
    }
    const conectadas = await this.contasWhatsapp.listarConectadas();
    if (conectadas.length === 0) throw new ValidacaoError('Nenhuma conta WhatsApp conectada');
    if (conectadas.length > 1)
      throw new ValidacaoError('Mais de uma conta WhatsApp conectada: informe qual usar');
    const [unica] = conectadas;
    if (!unica) throw new ValidacaoError('Nenhuma conta WhatsApp conectada');
    return unica;
  }
}

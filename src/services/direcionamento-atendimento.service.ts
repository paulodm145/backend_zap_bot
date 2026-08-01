import type {
  EncerrarConversaEntrada,
  ReatribuirConversaEntrada,
} from '../dtos/direcionamento-atendimento.dto.js';
import {
  AcessoNegadoError,
  ConflitoError,
  NaoEncontradoError,
  ValidacaoError,
} from '../erros/erro-aplicacao.js';
import type { DirecionamentoAtendimentoRepository } from '../repositories/direcionamento-atendimento.repository.js';
import { barramentoChat } from '../eventos/barramento-chat.js';

interface ContextoAtendimento {
  usuarioCentralPublicId: string;
  papel: 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE';
  tenantId: string;
}

export class DirecionamentoAtendimentoService {
  public constructor(private readonly repositorio: DirecionamentoAtendimentoRepository) {}

  public async assumir(conversaPublicId: string, contexto: ContextoAtendimento) {
    const [conversa, atendente] = await Promise.all([
      this.repositorio.buscarConversa(conversaPublicId),
      this.repositorio.buscarAtendente(contexto.usuarioCentralPublicId),
    ]);
    if (!conversa) throw new NaoEncontradoError('Conversa não encontrada');
    if (!atendente) throw new AcessoNegadoError('Usuário não possui perfil de atendente ativo');
    if (!conversa.setor_id)
      throw new ValidacaoError('Conversa ainda não foi direcionada a um setor');
    if ((await this.repositorio.possuiVinculo(atendente.id, conversa.setor_id)) === 0)
      throw new AcessoNegadoError('Atendente não pertence ao setor desta conversa');
    const assumiu = await this.repositorio.assumirAtomico(
      conversa.id,
      atendente.id,
      conversa.setor_id,
      contexto.usuarioCentralPublicId,
    );
    if (!assumiu) throw new ConflitoError('Conversa já foi assumida ou não está mais na fila');
    barramentoChat.publicar('conversa:assumida', {
      tenantId: contexto.tenantId,
      conversaId: conversa.public_id,
      ...(conversa.setor ? { setorId: conversa.setor.public_id } : {}),
      dados: { atendenteId: atendente.public_id },
    });
    return { conversaId: conversa.public_id, status: 'COM_ATENDENTE', atendente };
  }

  public async reatribuir(
    conversaPublicId: string,
    entrada: ReatribuirConversaEntrada,
    contexto: ContextoAtendimento,
  ) {
    this.exigirGestao(contexto);
    const [conversa, setor, autor, destino] = await Promise.all([
      this.repositorio.buscarConversa(conversaPublicId),
      this.repositorio.buscarSetor(entrada.setorId),
      this.repositorio.buscarAtendente(contexto.usuarioCentralPublicId),
      entrada.atendenteId
        ? this.repositorio.buscarAtendentePorPublicId(entrada.atendenteId)
        : Promise.resolve(null),
    ]);
    if (!conversa) throw new NaoEncontradoError('Conversa não encontrada');
    if (!setor) throw new NaoEncontradoError('Setor de destino não encontrado');
    if (entrada.atendenteId && !destino)
      throw new NaoEncontradoError('Atendente de destino não encontrado');
    if (destino && (await this.repositorio.possuiVinculo(destino.id, setor.id)) === 0)
      throw new ValidacaoError('Atendente de destino não pertence ao setor informado');
    await this.repositorio.reatribuir({
      conversaId: conversa.id,
      autorUsuarioPublicId: contexto.usuarioCentralPublicId,
      ...(autor ? { autorAtendenteId: autor.id } : {}),
      ...(conversa.atendente_id ? { origemAtendenteId: conversa.atendente_id } : {}),
      ...(destino ? { destinoAtendenteId: destino.id } : {}),
      ...(conversa.setor_id ? { origemSetorId: conversa.setor_id } : {}),
      destinoSetorId: setor.id,
      motivo: entrada.motivo,
    });
    barramentoChat.publicar('conversa:atualizada', {
      tenantId: contexto.tenantId,
      conversaId: conversa.public_id,
      setorId: setor.public_id,
      dados: { status: destino ? 'COM_ATENDENTE' : 'AGUARDANDO_ATENDENTE' },
    });
    return {
      conversaId: conversa.public_id,
      status: destino ? 'COM_ATENDENTE' : 'AGUARDANDO_ATENDENTE',
      setor,
      atendente: destino,
    };
  }

  public async encerrar(
    conversaPublicId: string,
    entrada: EncerrarConversaEntrada,
    contexto: ContextoAtendimento,
  ) {
    const [conversa, autor] = await Promise.all([
      this.repositorio.buscarConversa(conversaPublicId),
      this.repositorio.buscarAtendente(contexto.usuarioCentralPublicId),
    ]);
    if (!conversa) throw new NaoEncontradoError('Conversa não encontrada');
    if (contexto.papel === 'ATENDENTE' && autor?.id !== conversa.atendente_id)
      throw new AcessoNegadoError('Somente o atendente responsável pode encerrar a conversa');
    if (entrada.devolverAoBot && !conversa.estado_fluxo)
      throw new ValidacaoError('Conversa não possui snapshot de fluxo para retornar ao bot');
    await this.repositorio.encerrar({
      conversaId: conversa.id,
      autorUsuarioPublicId: contexto.usuarioCentralPublicId,
      ...(autor ? { autorAtendenteId: autor.id } : {}),
      ...(conversa.atendente_id ? { origemAtendenteId: conversa.atendente_id } : {}),
      ...(conversa.setor_id ? { origemSetorId: conversa.setor_id } : {}),
      ...(entrada.motivo ? { motivo: entrada.motivo } : {}),
      devolverAoBot: entrada.devolverAoBot,
    });
    barramentoChat.publicar('conversa:atualizada', {
      tenantId: contexto.tenantId,
      conversaId: conversa.public_id,
      ...(conversa.setor ? { setorId: conversa.setor.public_id } : {}),
      dados: { status: entrada.devolverAoBot ? 'BOT' : 'ENCERRADA' },
    });
    return {
      conversaId: conversa.public_id,
      status: entrada.devolverAoBot ? 'BOT' : 'ENCERRADA',
      estadoFluxoRestaurado: entrada.devolverAoBot ? conversa.estado_fluxo : null,
    };
  }

  private exigirGestao(contexto: ContextoAtendimento): void {
    if (contexto.papel === 'ATENDENTE')
      throw new AcessoNegadoError('Somente administração ou gestão pode reatribuir conversas');
  }
}

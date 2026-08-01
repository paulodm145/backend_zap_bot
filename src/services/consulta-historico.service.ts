import type {
  ListarContatosEntrada,
  ListarConversasEntrada,
  ListarMensagensEntrada,
} from '../dtos/historico.dto.js';
import { NaoEncontradoError, ValidacaoError } from '../erros/erro-aplicacao.js';
import {
  codificarCursorTemporal,
  decodificarCursorTemporal,
} from '../helpers/cursor-temporal.helper.js';
import type { ConsultaHistoricoRepository } from '../repositories/consulta-historico.repository.js';

interface ContextoConsulta {
  usuarioCentralPublicId: string;
  papel: 'ADMIN_TENANT' | 'GESTOR' | 'ATENDENTE';
}

export class ConsultaHistoricoService {
  public constructor(private readonly historico: ConsultaHistoricoRepository) {}
  public listarContatos(entrada: ListarContatosEntrada, contexto: ContextoConsulta) {
    return this.historico.listarContatos(entrada, this.escopo(contexto));
  }
  public listarConversas(entrada: ListarConversasEntrada, contexto: ContextoConsulta) {
    return this.historico.listarConversas(entrada, this.escopo(contexto));
  }
  public async buscarConversa(publicId: string, contexto: ContextoConsulta) {
    const conversa = await this.historico.buscarConversa(publicId, this.escopo(contexto));
    if (!conversa) throw new NaoEncontradoError('Conversa não encontrada');
    return conversa;
  }
  public async listarMensagens(
    publicId: string,
    entrada: ListarMensagensEntrada,
    contexto: ContextoConsulta,
  ) {
    await this.buscarConversa(publicId, contexto);
    let cursor;
    if (entrada.cursor) {
      const decodificado = decodificarCursorTemporal(entrada.cursor);
      if (!decodificado) throw new ValidacaoError('Cursor de mensagens inválido');
      cursor = decodificado;
    }
    const registros = await this.historico.listarMensagens(
      publicId,
      entrada.take,
      cursor,
      this.escopo(contexto),
    );
    const possuiMais = registros.length > entrada.take;
    const pagina = registros.slice(0, entrada.take);
    const ultimo = pagina.at(-1);
    const proximoCursor =
      possuiMais && ultimo
        ? codificarCursorTemporal({ ocorreuAt: ultimo.ocorreu_at, id: ultimo.id })
        : null;
    const dados = pagina.reverse().map(({ id, ...mensagem }) => {
      void id;
      return mensagem;
    });
    return { dados, proximoCursor };
  }
  private escopo(contexto: ContextoConsulta): string | undefined {
    return contexto.papel === 'ATENDENTE' ? contexto.usuarioCentralPublicId : undefined;
  }
}

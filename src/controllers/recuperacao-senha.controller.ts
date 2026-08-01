import type { Request, Response } from 'express';
import type { EsqueciSenhaEntrada, RedefinirSenhaEntrada } from '../dtos/recuperacao-senha.dto.js';
import type { RecuperacaoSenhaService } from '../services/recuperacao-senha.service.js';

export class RecuperacaoSenhaController {
  public constructor(private readonly recuperacao: RecuperacaoSenhaService) {}
  public solicitar = async (requisicao: Request, resposta: Response): Promise<void> => {
    await this.recuperacao.solicitar(requisicao.body as EsqueciSenhaEntrada);
    resposta
      .status(202)
      .json({ mensagem: 'Se o e-mail estiver cadastrado, enviaremos as instruções.' });
  };
  public redefinir = async (requisicao: Request, resposta: Response): Promise<void> => {
    await this.recuperacao.redefinir(requisicao.body as RedefinirSenhaEntrada);
    resposta.status(204).send();
  };
}

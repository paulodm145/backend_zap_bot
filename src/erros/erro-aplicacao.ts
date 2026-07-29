export class ErroAplicacao extends Error {
  public constructor(
    public readonly codigo: string,
    mensagem: string,
    public readonly statusCode: number,
    public readonly detalhes?: unknown,
  ) {
    super(mensagem);
    this.name = new.target.name;
  }
}

export class NaoAutenticadoError extends ErroAplicacao {
  public constructor(mensagem = 'Autenticação necessária') {
    super('NAO_AUTENTICADO', mensagem, 401);
  }
}

export class AcessoNegadoError extends ErroAplicacao {
  public constructor(mensagem = 'Acesso negado') {
    super('ACESSO_NEGADO', mensagem, 403);
  }
}

export class NaoEncontradoError extends ErroAplicacao {
  public constructor(mensagem: string) {
    super('NAO_ENCONTRADO', mensagem, 404);
  }
}

export class ValidacaoError extends ErroAplicacao {
  public constructor(mensagem: string, detalhes?: unknown) {
    super('VALIDACAO', mensagem, 422, detalhes);
  }
}

export class MuitasRequisicoesError extends ErroAplicacao {
  public constructor(mensagem = 'Limite de tentativas excedido') {
    super('LIMITE_TENTATIVAS', mensagem, 429);
  }
}

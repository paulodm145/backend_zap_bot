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

export class CredenciaisInvalidasError extends ErroAplicacao {
  public constructor(mensagem = 'E-mail ou senha inválidos') {
    super('CREDENCIAIS_INVALIDAS', mensagem, 401);
  }
}

export class RefreshTokenInvalidoError extends ErroAplicacao {
  public constructor(mensagem = 'Refresh token inválido ou expirado') {
    super('REFRESH_TOKEN_INVALIDO', mensagem, 401);
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

export class ConflitoError extends ErroAplicacao {
  public constructor(mensagem: string) {
    super('CONFLITO', mensagem, 409);
  }
}

export class NoFluxoDesconhecidoError extends ErroAplicacao {
  public constructor(tipo: string) {
    super('NO_FLUXO_DESCONHECIDO', `Tipo de nó desconhecido: ${tipo}`, 422);
  }
}

export class LimiteExecucaoFluxoError extends ErroAplicacao {
  public constructor() {
    super('LIMITE_EXECUCAO_FLUXO', 'O fluxo excedeu o limite de passos por execução', 422);
  }
}

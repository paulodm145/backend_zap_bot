export interface VerificadorDependencia {
  nome: string;
  verificar(): Promise<void>;
}

export interface EstadoDependencia {
  nome: string;
  disponivel: boolean;
}

export interface ResultadoProntidao {
  pronto: boolean;
  dependencias: EstadoDependencia[];
}

export class ProntidaoService {
  public constructor(private readonly verificadores: VerificadorDependencia[]) {}

  public async verificar(): Promise<ResultadoProntidao> {
    const dependencias = await Promise.all(
      this.verificadores.map(async (verificador): Promise<EstadoDependencia> => {
        try {
          await verificador.verificar();
          return { nome: verificador.nome, disponivel: true };
        } catch {
          return { nome: verificador.nome, disponivel: false };
        }
      }),
    );

    return {
      pronto: dependencias.every((dependencia) => dependencia.disponivel),
      dependencias,
    };
  }
}

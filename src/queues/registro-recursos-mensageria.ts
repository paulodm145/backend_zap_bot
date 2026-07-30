interface RecursoFechavel {
  close(): Promise<void>;
}

export class RegistroRecursosMensageria {
  private readonly recursos = new Set<RecursoFechavel>();

  public registrar<T extends RecursoFechavel>(recurso: T): T {
    this.recursos.add(recurso);
    return recurso;
  }

  public async fecharTodos(): Promise<void> {
    const recursos = [...this.recursos].reverse();
    await Promise.all(recursos.map((recurso) => recurso.close()));
    this.recursos.clear();
  }
}

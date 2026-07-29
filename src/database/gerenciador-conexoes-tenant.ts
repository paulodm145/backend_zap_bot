import { PrismaPg } from '@prisma/adapter-pg';

import { ambiente } from '../config/ambiente.js';
import { logger } from '../config/logger.js';
import { PrismaClient } from '../generated/prisma-tenant/client.js';

export interface GerenciadorConexoesTenant {
  obter(tenantId: number, stringConexao: string): Promise<PrismaClient>;
  fecharTodos(): Promise<void>;
}

export class GerenciadorConexoesTenantLru implements GerenciadorConexoesTenant {
  private readonly clientes = new Map<number, PrismaClient>();
  private readonly aberturas = new Map<number, Promise<PrismaClient>>();

  public constructor(private readonly limite: number) {}

  public async obter(tenantId: number, stringConexao: string): Promise<PrismaClient> {
    const existente = this.clientes.get(tenantId);
    if (existente) {
      this.clientes.delete(tenantId);
      this.clientes.set(tenantId, existente);
      return existente;
    }

    const aberturaExistente = this.aberturas.get(tenantId);
    if (aberturaExistente) return aberturaExistente;

    const abertura = this.abrir(tenantId, stringConexao);
    this.aberturas.set(tenantId, abertura);
    try {
      return await abertura;
    } finally {
      this.aberturas.delete(tenantId);
    }
  }

  public async fecharTodos(): Promise<void> {
    const clientes = [...this.clientes.values()];
    this.clientes.clear();
    await Promise.all(clientes.map((cliente) => cliente.$disconnect()));
    logger.info({ quantidade: clientes.length }, 'Clientes de tenant encerrados');
  }

  private async abrir(tenantId: number, stringConexao: string): Promise<PrismaClient> {
    if (this.clientes.size >= this.limite) {
      const tenantMaisAntigo = this.clientes.keys().next().value;
      if (tenantMaisAntigo !== undefined) {
        const removido = this.clientes.get(tenantMaisAntigo);
        this.clientes.delete(tenantMaisAntigo);
        await removido?.$disconnect();
        logger.debug({ tenantId: tenantMaisAntigo }, 'Cliente de tenant removido do cache');
      }
    }

    const cliente = new PrismaClient({ adapter: new PrismaPg(stringConexao) });
    await cliente.$connect();
    this.clientes.set(tenantId, cliente);
    logger.debug({ tenantId, clientesAtivos: this.clientes.size }, 'Cliente de tenant aberto');
    return cliente;
  }
}

let instancia: GerenciadorConexoesTenantLru | undefined;

export function obterGerenciadorConexoesTenant(): GerenciadorConexoesTenantLru {
  instancia ??= new GerenciadorConexoesTenantLru(ambiente.TENANT_CLIENTES_CACHE_MAXIMO);
  return instancia;
}

export async function fecharConexoesTenant(): Promise<void> {
  if (!instancia) return;
  await instancia.fecharTodos();
  instancia = undefined;
}

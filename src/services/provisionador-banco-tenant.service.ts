import { spawn } from 'node:child_process';

import { Client } from 'pg';

export interface ProvisionadorBancoTenant {
  criarSeAusente(nomeBanco: string): Promise<string>;
  aplicarMigrations(stringConexao: string): Promise<void>;
}

export class ProvisionadorBancoTenantService implements ProvisionadorBancoTenant {
  public constructor(private readonly postgresAdminUrl: string) {}

  public async criarSeAusente(nomeBanco: string): Promise<string> {
    if (!/^zapbot_tenant_[a-f0-9]{12}$/.test(nomeBanco)) {
      throw new Error('Nome de banco do tenant inválido');
    }
    const cliente = new Client({ connectionString: this.postgresAdminUrl });
    await cliente.connect();
    try {
      const existente = await cliente.query<{ existe: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS existe',
        [nomeBanco],
      );
      if (!existente.rows[0]?.existe) {
        await cliente.query(`CREATE DATABASE "${nomeBanco}" ENCODING 'UTF8'`);
      }
    } finally {
      await cliente.end();
    }
    const url = new URL(this.postgresAdminUrl);
    url.pathname = `/${nomeBanco}`;
    return url.toString();
  }

  public aplicarMigrations(stringConexao: string): Promise<void> {
    return new Promise((resolver, rejeitar) => {
      const processo = spawn(
        'npm',
        ['exec', 'prisma', '--', 'migrate', 'deploy', '--config', 'prisma.tenant.config.ts'],
        {
          cwd: process.cwd(),
          env: { ...process.env, TENANT_DATABASE_URL: stringConexao },
          stdio: ['ignore', 'ignore', 'pipe'],
        },
      );
      let erro = '';
      processo.stderr.on('data', (trecho: Buffer) => {
        erro += trecho.toString('utf8');
      });
      processo.once('error', rejeitar);
      processo.once('exit', (codigo) => {
        if (codigo === 0) {
          resolver();
          return;
        }
        rejeitar(new Error(erro.trim() || `Migration falhou com código ${String(codigo)}`));
      });
    });
  }
}

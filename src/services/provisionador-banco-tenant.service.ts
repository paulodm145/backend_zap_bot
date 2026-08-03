import { spawn } from 'node:child_process';

import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma-tenant/client.js';
import { normalizarTextoBusca } from '../helpers/texto.helper.js';
import { validarNomeBancoTenant } from '../helpers/banco-tenant.helper.js';

export interface ProvisionadorBancoTenant {
  criarSeAusente(nomeBanco: string): Promise<string>;
  aplicarMigrations(stringConexao: string): Promise<void>;
  criarPerfilAdministrador(
    stringConexao: string,
    administrador: { publicId: string; nome: string; email: string },
  ): Promise<void>;
}

export interface ExclusorBancoTenant {
  excluirDefinitivamente(nomeBanco: string): Promise<void>;
}

export class ProvisionadorBancoTenantService implements ProvisionadorBancoTenant {
  public constructor(private readonly postgresAdminUrl: string) {}

  public async criarSeAusente(nomeBanco: string): Promise<string> {
    validarNomeBancoTenant(nomeBanco);
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

  public async excluirDefinitivamente(nomeBanco: string): Promise<void> {
    const nomeValidado = validarNomeBancoTenant(nomeBanco);
    const cliente = new Client({ connectionString: this.postgresAdminUrl });
    await cliente.connect();
    try {
      await cliente.query(`DROP DATABASE IF EXISTS "${nomeValidado}" WITH (FORCE)`);
    } finally {
      await cliente.end();
    }
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

  public async criarPerfilAdministrador(
    stringConexao: string,
    administrador: { publicId: string; nome: string; email: string },
  ): Promise<void> {
    const prisma = new PrismaClient({ adapter: new PrismaPg(stringConexao) });
    try {
      await prisma.usuarioTenant.upsert({
        where: { usuario_central_public_id: administrador.publicId },
        create: {
          usuario_central_public_id: administrador.publicId,
          nome: administrador.nome,
          nome_normalizado: normalizarTextoBusca(administrador.nome),
          email: administrador.email,
          papel: 'ADMIN_TENANT',
        },
        update: {
          nome: administrador.nome,
          nome_normalizado: normalizarTextoBusca(administrador.nome),
          email: administrador.email,
          papel: 'ADMIN_TENANT',
          ativo: true,
          deletado_at: null,
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  }
}

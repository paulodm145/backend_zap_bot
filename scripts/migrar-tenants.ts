import { spawn } from 'node:child_process';

import { ambiente } from '../src/config/ambiente.js';
import { logger } from '../src/config/logger.js';
import { desconectarPrismaCentral, obterPrismaCentral } from '../src/database/prisma-central.js';
import { CriptografiaService } from '../src/services/criptografia.service.js';
import {
  MigradorTenantsService,
  type TenantParaMigracao,
} from '../src/services/migrador-tenants.service.js';

const prisma = obterPrismaCentral();
const criptografia = new CriptografiaService(ambiente.TENANT_CONEXAO_CRIPTOGRAFIA_CHAVE);
const CHAVE_LOCK = 7_310_426_101;

function executarMigration(tenant: TenantParaMigracao): Promise<void> {
  const stringConexao = criptografia.descriptografar(tenant.stringConexaoCriptografada);
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
        logger.info({ tenantId: tenant.publicId }, 'Migration de tenant aplicada');
        resolver();
        return;
      }
      rejeitar(new Error(erro.trim() || `Prisma finalizou com código ${String(codigo)}`));
    });
  });
}

try {
  const [lock] = await prisma.$queryRaw<{ adquirido: boolean }[]>`
    SELECT pg_try_advisory_lock(${CHAVE_LOCK}) AS adquirido
  `;
  if (!lock?.adquirido) {
    throw new Error('Já existe uma execução de migrations multi-tenant em andamento');
  }

  const tenants = await prisma.tenant.findMany({
    where: {
      status: 'ATIVO',
      deletado_at: null,
      string_conexao_encrypted: { not: null },
    },
    select: {
      id: true,
      public_id: true,
      string_conexao_encrypted: true,
    },
  });
  const entrada = tenants.flatMap((tenant) =>
    tenant.string_conexao_encrypted
      ? [
          {
            id: tenant.id,
            publicId: tenant.public_id,
            stringConexaoCriptografada: tenant.string_conexao_encrypted,
          },
        ]
      : [],
  );
  const resumo = await new MigradorTenantsService(executarMigration).migrar(entrada);
  logger.info(
    { total: resumo.total, sucessos: resumo.sucessos, falhas: resumo.falhas },
    'Migrations multi-tenant concluídas',
  );
  process.exitCode = resumo.falhas === 0 ? 0 : 1;
} finally {
  await prisma.$queryRaw`SELECT pg_advisory_unlock(${CHAVE_LOCK})`;
  await desconectarPrismaCentral();
}

import 'dotenv/config';

import { z } from 'zod';

import { ambiente } from '../src/config/ambiente.js';
import { desconectarPrismaCentral, obterPrismaCentral } from '../src/database/prisma-central.js';
import { lerArgumentosNomeados } from '../src/helpers/argumentos-cli.helper.js';
import { normalizarEmail } from '../src/helpers/email.helper.js';
import { TenantCentralRepository } from '../src/repositories/tenant-central.repository.js';
import { CriptografiaService } from '../src/services/criptografia.service.js';
import { HashSenhaService } from '../src/services/hash-senha.service.js';
import { ProvisionadorBancoTenantService } from '../src/services/provisionador-banco-tenant.service.js';
import { ProvisionamentoTenantService } from '../src/services/provisionamento-tenant.service.js';

/**
 * Chave de idempotência fixa usada quando nenhuma é informada. Rodar este
 * script várias vezes com os valores padrão reaproveita o mesmo tenant em vez
 * de criar duplicatas, o que o torna seguro para reexecução em ambiente local.
 */
const CHAVE_IDEMPOTENCIA_PADRAO = '00000000-0000-4000-8000-000000000001';

const entradaSchema = z.object({
  nome: z.string().trim().min(2).max(150),
  planoNome: z.string().trim().min(1).max(80),
  chaveIdempotencia: z.uuid(),
  administradorNome: z.string().trim().min(2).max(150),
  administradorEmail: z.string().trim().pipe(z.email().max(254)).transform(normalizarEmail),
  administradorSenha: z.string().min(12).max(128),
});

async function executar(): Promise<void> {
  const argumentos = lerArgumentosNomeados(process.argv.slice(2));
  const entrada = entradaSchema.parse({
    nome: argumentos.nome ?? process.env.DEMO_TENANT_NOME ?? 'Tenant Demonstração',
    planoNome: argumentos.plano ?? process.env.DEMO_TENANT_PLANO ?? 'Free',
    chaveIdempotencia:
      argumentos.chave ?? process.env.DEMO_TENANT_CHAVE ?? CHAVE_IDEMPOTENCIA_PADRAO,
    administradorNome:
      argumentos['admin-nome'] ??
      process.env.DEMO_TENANT_ADMIN_NOME ??
      'Administrador Demonstração',
    administradorEmail:
      argumentos['admin-email'] ?? process.env.DEMO_TENANT_ADMIN_EMAIL ?? 'admin@tenant.local',
    administradorSenha:
      argumentos['admin-senha'] ?? process.env.DEMO_TENANT_ADMIN_SENHA ?? 'DemoLocal!2026',
  });

  const prisma = obterPrismaCentral();

  try {
    const plano = await prisma.plano.findUnique({ where: { nome: entrada.planoNome } });
    if (!plano?.ativo) {
      throw new Error(
        `Plano "${entrada.planoNome}" não encontrado ou inativo. Rode "npm run db:central:seed" antes deste comando.`,
      );
    }

    const tenants = new TenantCentralRepository(prisma);
    const criptografia = new CriptografiaService(ambiente.TENANT_CONEXAO_CRIPTOGRAFIA_CHAVE);
    const provisionador = new ProvisionadorBancoTenantService(
      ambiente.POSTGRES_ADMIN_URL ?? 'postgresql://configuracao:ausente@localhost:5432/postgres',
    );
    const provisionamento = new ProvisionamentoTenantService(
      tenants,
      new HashSenhaService(),
      criptografia,
      provisionador,
    );

    const tenant = await provisionamento.provisionar({
      chaveIdempotencia: entrada.chaveIdempotencia,
      nome: entrada.nome,
      planoId: plano.public_id,
      administrador: {
        nome: entrada.administradorNome,
        email: entrada.administradorEmail,
        senha: entrada.administradorSenha,
      },
    });

    if (tenant.status !== 'ATIVO') {
      throw new Error(
        `Provisionamento não concluiu (status "${tenant.status}"). Verifique os logs e rode o comando novamente.`,
      );
    }

    process.stdout.write('Tenant de demonstração provisionado com sucesso\n');
    process.stdout.write(`  tenantId (public_id): ${tenant.public_id}\n`);
    process.stdout.write(`  nome: ${tenant.nome}\n`);
    process.stdout.write(`  plano: ${entrada.planoNome}\n`);
    process.stdout.write(`  banco: ${tenant.nome_do_banco ?? '(não disponível)'}\n`);
    process.stdout.write(`  administrador: ${entrada.administradorEmail}\n`);
  } finally {
    await desconectarPrismaCentral();
  }
}

executar().catch((erro: unknown) => {
  process.stderr.write(`Falha ao provisionar tenant de demonstração: ${String(erro)}\n`);
  process.exitCode = 1;
});

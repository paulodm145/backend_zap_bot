const PADRAO_NOME_BANCO_TENANT = /^zapbot_tenant_[a-f0-9]{12}$/;

export function validarNomeBancoTenant(nomeBanco: string): string {
  if (!PADRAO_NOME_BANCO_TENANT.test(nomeBanco)) {
    throw new Error('Nome de banco do tenant inválido');
  }
  return nomeBanco;
}

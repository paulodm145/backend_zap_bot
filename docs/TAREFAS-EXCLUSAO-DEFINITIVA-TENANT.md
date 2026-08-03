# Tarefas — bloqueio e exclusão definitiva de tenant

Branch: `feat/exclusao-definitiva-tenant`

Dependência de integração: `feat/impersonacao-tenant` deve entrar primeiro na `main`.

- [x] Confirmar o endpoint existente de suspensão e suas transições.
- [x] Mapear relações centrais removidas com o tenant.
- [x] Mapear encerramento do pool antes do drop do banco.
- [x] Definir DTO com senha, confirmação, nome exato e motivo.
- [x] Reautenticar o `SUPER_ADMIN` antes da operação destrutiva.
- [x] Exigir tenant previamente suspenso ou cancelado.
- [x] Validar o nome físico do banco antes do drop.
- [x] Encerrar conexões do tenant mantidas pela aplicação.
- [x] Executar drop forçado do banco com identificador protegido.
- [x] Não remover registros centrais quando o drop falhar.
- [x] Remover usuários, sessões, assinaturas e tenant em transação central.
- [x] Preservar auditoria da exclusão definitiva.
- [x] Implementar endpoint interno protegido com resposta 204.
- [x] Documentar contrato e erros no OpenAPI.
- [x] Documentar confirmação e estados da tela administrativa.
- [x] Registrar na arquitetura a exceção à política de retenção.
- [x] Testar suspensão, senha inválida, confirmação, falha de drop e sucesso.
- [x] Executar formatação, lint, TypeScript, build e testes.
- [x] Criar commit semântico e enviar a branch remota.

# Tarefas — exclusão definitiva de conta WhatsApp

Branch: `feat/exclusao-conta-whatsapp`

Contexto: ao investigar um `500` relatado no botão "Desconectar" (ver
`fix/desconectar-instancia-nao-conectada`), o usuário revelou que na verdade
queria excluir a conta — e essa ação nunca existiu. Só havia desconectar
(reversível) e ativar/desativar. O schema já previa `deletado_at` em
`ContaWhatsapp`, mas nenhuma rota/service/repository a usava.

## Backend

- [x] `ContaWhatsappRepository.excluir(publicId, autorUsuarioId)`: soft delete
      (`deletado_at` + `ativo:false`) seguindo o mesmo padrão de
      Fluxo/Setor, mas com o registro de auditoria (`AuditoriaWhatsapp`,
      `acao: 'EXCLUIR'`) já usado pelas outras mutações desta entidade.
- [x] `ContaWhatsappService.excluir`: desfaz a instância na Evolution API
      (`excluirInstancia`) antes do soft delete; falha na Evolution não
      bloqueia a exclusão (registro no tenant é a fonte de verdade).
- [x] `DELETE /api/v1/contas-whatsapp/:contaId` (mesmo guard `exigirAdminTenant`
      das demais rotas do recurso), `204` sem corpo.
- [x] OpenAPI documentado.

## Documentação

- [x] `docs/api/contas-whatsapp.md` (backend e cópia espelhada no frontend):
      nova jornada "Excluir", endpoint na tabela, nota sobre resposta `204`
      sem corpo.

## Testes

- [x] Unitários do service: sucesso, sucesso mesmo com falha da Evolution,
      rejeita conta inexistente.
- [x] Integração via API real: ciclo completo até excluir, `404` no GET
      seguinte, `deletado_at` preenchido, auditoria `EXCLUIR` registrada,
      excluir de novo responde `404`.

## Frontend

- [x] Botão "Excluir" na lista de contas WhatsApp (`WhatsAppAccountsView`),
      com `ConfirmDialog` dedicado (aviso explícito de que não há desfazer).
- [x] Corrigido de passagem: o diálogo de "Desconectar" usava o rótulo padrão
      "Excluir" do `ConfirmDialog` (`confirmLabel` não era passado) — texto
      enganoso já que essa ação não é uma exclusão. Ambos os diálogos agora
      têm rótulos corretos.

## Checklist de saída

- [x] `npm run format:check`, `npm run lint`, `npm run typecheck` sem erros
      (backend).
- [x] `npm run test:coverage` completo aprovado (212+ testes, branches acima
      do limiar de 70%).
- [x] `npm run build` aprovado nos dois repositórios.
- [ ] Branches prontas para revisão e merge — aguardando commit/PR do
      frontend e merge de ambas.

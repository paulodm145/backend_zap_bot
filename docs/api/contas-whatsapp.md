# Contas WhatsApp do tenant

## Objetivo e permissão

Esta funcionalidade implementa o onboarding manual da WhatsApp Cloud API.
Somente `ADMIN_TENANT` acessa as rotas. Cada conta e sua credencial ficam no
banco físico do tenant; o banco central guarda apenas o vínculo técnico
`phone_number_id -> tenant` usado para resolver webhooks.

Os planos permitem: Free uma conta, Starter uma conta e Pro três contas. O
backend valida o limite; o frontend deve tratar `422 VALIDACAO` ao cadastrar ou
reativar acima do plano.

## Endpoints

| Método | Rota                                       | Finalidade              |
| ------ | ------------------------------------------ | ----------------------- |
| GET    | `/api/v1/contas-whatsapp`                  | Listagem paginada       |
| POST   | `/api/v1/contas-whatsapp`                  | Cadastrar e sincronizar |
| GET    | `/api/v1/contas-whatsapp/{contaId}`        | Abrir detalhe           |
| PUT    | `/api/v1/contas-whatsapp/{contaId}`        | Atualizar metadados     |
| PATCH  | `/api/v1/contas-whatsapp/{contaId}/token`  | Rotacionar credencial   |
| PATCH  | `/api/v1/contas-whatsapp/{contaId}/status` | Ativar ou desativar     |
| POST   | `/api/v1/contas-whatsapp/{contaId}/testar` | Validar na Graph API    |

## Tela de onboarding

Solicite nome interno, `phoneNumberId`, `wabaId`, número de exibição opcional,
versão da Graph API e access token. O token é aceito somente no cadastro e na
rotação: nunca aparece em listagem, detalhe, teste, erro ou auditoria. Após o
cadastro, descarte-o imediatamente do estado do formulário.

```json
{
  "nome": "Número principal",
  "phoneNumberId": "123456789012345",
  "wabaId": "987654321098765",
  "numeroExibicao": "+55 11 99999-9999",
  "versaoGraphApi": "v23.0",
  "accessToken": "token-fornecido-pela-meta"
}
```

O cadastro começa com `status: PENDENTE`. Em seguida, chame `/testar`. Mostre
`VALIDADA` em verde, `PENDENTE` como configuração não testada e `INVALIDA` com
`ultimo_erro_codigo` e `ultimo_erro_mensagem`. Esses textos são sanitizados e
não incluem a resposta bruta nem a credencial.

## Rotação e diagnóstico

Use o endpoint `/token` em modal separado com confirmação. O novo token volta
a conta para `PENDENTE`; execute `/testar` após o sucesso. Falha de validação
não apaga o token nem desativa automaticamente a conta, permitindo correção
sem interromper o formulário.

Um `409 CONFLITO` indica que o `phone_number_id` já está associado a outro
tenant e requer intervenção administrativa. Nunca ofereça campo de `tenantId`
ou banco: a conexão continua sendo resolvida pelo e-mail autenticado.

## Listagem e estados

A listagem usa `skip`, `take` e `busca`, buscando por nome ou número de
exibição. Mostre nome, número, status de validação, ativo e data da última
validação. Não tente mascarar um token: o campo simplesmente não existe nas
respostas.

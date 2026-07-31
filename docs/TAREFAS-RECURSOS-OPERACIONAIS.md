# Tarefas dos recursos operacionais

## Como usar

Este arquivo é a fonte de verdade da próxima fase. Deve ser atualizado no
mesmo commit de cada implementação.

- `[ ]`: pendente;
- `[x]`: concluída e validada;
- cada etapa usa uma branch própria criada da `main` atualizada;
- uma tarefa só é marcada após código, testes e documentação correspondentes;
- divergências de arquitetura devem ser apresentadas antes da implementação;
- trabalho descoberto deve ser adicionado antes de ser executado.

## Decisões de arquitetura desta fase

### Identidade, usuário e atendente

`central_db.users` continua sendo a fonte de autenticação, senha, e-mail,
papel global e vínculo com tenant. O banco físico do tenant mantém perfil
operacional, permissões detalhadas e vínculos com setores. Alterações que
atravessem os dois bancos exigem serviço idempotente e compensação explícita,
pois não existe transação ACID única entre bancos.

### Configuração independente do WhatsApp

Cada tenant possui sua própria `contas_whatsapp`, com WABA, número,
`phone_number_id`, token criptografado, versão da API, status e datas de
validação dentro do banco físico do tenant. O banco central guarda somente o
índice técnico mínimo `phone_number_id -> tenant`, pois o webhook precisa
descobrir o banco antes de abri-lo. Credenciais nunca ficam no banco central.

### Cadastro da empresa

O banco central mantém nome operacional, plano e status. Razão social, nome
fantasia, CNPJ, contatos e endereço pertencem ao banco físico do tenant e podem
ser preenchidos após a contratação. CNPJ e CEP devem ser normalizados; dados
retornados por integrações externas são sugestões editáveis, não verdade
imutável.

### Estados e municípios

Estados e municípios são catálogo público compartilhado no banco central. O
perfil da empresa salva o código IBGE e um snapshot textual do endereço. O
importador usa os endpoints BrasilAPI `/api/ibge/uf/v1` e
`/api/ibge/municipios/v1/{siglaUF}`, com timeout, retry limitado, validação Zod,
upsert e relatório. A indisponibilidade externa não pode impedir a API de
iniciar. Referência: [documentação oficial da BrasilAPI](https://brasilapi.com.br/docs).

### Permissões

O MVP usa RBAC: `ADMIN_TENANT`, `GESTOR` e `ATENDENTE`. Permissões granulares
são atribuídas aos papéis e avaliadas no backend. O frontend usa as permissões
retornadas apenas para compor a interface; o backend continua sendo a fonte de
autorização.

### Conversas e atendimento

O fluxo documentado é `BOT -> AGUARDANDO_ATENDENTE -> COM_ATENDENTE ->
ENCERRADA`. Atendentes podem pertencer a vários setores. O claim é um `UPDATE`
condicional atômico; apenas um atendente assume a conversa. Redis/Socket.io
mantêm presença e eventos efêmeros, enquanto mensagens e mudanças relevantes
ficam persistidas no PostgreSQL tenant.

## Divergências que devem ser tratadas antes das etapas dependentes

1. `Atendente.setor_id` implementa hoje vínculo 1:N, enquanto PRD e arquitetura
   exigem N:N entre atendentes e setores.
2. `StatusConversa` possui `ABERTA`, `AGUARDANDO` e `FINALIZADA`, enquanto o
   fluxo documentado exige quatro estados distintos.
3. `ContaWhatsapp` já é tenant-specific, mas ainda não possui WABA, número
   legível, versão da API, expiração/validação do token nem endpoints de gestão.
4. Usuários autenticáveis estão no banco central e atendentes no tenant, mas
   ainda não existe sincronização idempotente nem modelo de permissões.

Nenhuma dessas divergências deve ser resolvida implicitamente durante outra
tarefa.

## Visão das etapas

| Etapa                                | Branch                               | Dependência    | Estado       |
| ------------------------------------ | ------------------------------------ | -------------- | ------------ |
| 00. Planejamento e decisões          | `docs/backlog-recursos-operacionais` | Estrutura base | Em andamento |
| 12. Catálogo geográfico e empresa    | `feat/cadastro-empresa-geografia`    | 00             | Pendente     |
| 13. Configuração WhatsApp por tenant | `feat/configuracao-whatsapp-tenant`  | 00 e 12        | Pendente     |
| 14. Usuários e RBAC                  | `feat/usuarios-permissoes`           | 00             | Pendente     |
| 15. Recuperação de senha             | `feat/recuperacao-senha`             | 14             | Pendente     |
| 16. Setores e vínculos de atendentes | `feat/setores-atendentes`            | 14             | Pendente     |
| 17. Perfil do usuário autenticado    | `feat/perfil-usuario-logado`         | 14             | Pendente     |
| 18. Histórico de conversas           | `feat/historico-conversas`           | 13 e 16        | Pendente     |
| 19. Direcionamento e claim           | `feat/direcionamento-atendimento`    | 16 e 18        | Pendente     |
| 20. Mensagens e Cloud API            | `feat/mensagens-whatsapp`            | 13, 18 e 19    | Pendente     |
| 21. Chat em tempo real               | `feat/chat-atendimento`              | 19 e 20        | Pendente     |

---

## Etapa 00 — Planejamento e decisões

Branch: `docs/backlog-recursos-operacionais`

- [x] Revisar PRD e arquitetura dos recursos solicitados.
- [x] Revisar modelos Prisma central e tenant existentes.
- [x] Registrar divergência do vínculo atendente-setor.
- [x] Registrar divergência dos estados de conversa.
- [x] Definir separação da configuração WhatsApp central/tenant.
- [x] Definir localização dos dados cadastrais da empresa.
- [x] Verificar endpoints de UF e municípios da BrasilAPI.
- [x] Definir ordem de dependência das próximas etapas.
- [ ] Revisar e aprovar este backlog com o responsável pelo produto.
- [ ] Marcar esta etapa como concluída.

---

## Etapa 12 — Catálogo geográfico e cadastro da empresa

Branch: `feat/cadastro-empresa-geografia`

### Catálogo central

- [ ] Criar modelo central `Estado` com ID inteiro, código IBGE e sigla única.
- [ ] Criar modelo central `Municipio` com ID inteiro e código IBGE único.
- [ ] Relacionar município ao estado.
- [ ] Adicionar `created_at` e `updated_at`.
- [ ] Criar índices por sigla, nome normalizado, estado e código IBGE.
- [ ] Criar migration central separada.
- [ ] Criar schemas Zod para respostas externas de UF.
- [ ] Criar schemas Zod para respostas externas de municípios.
- [ ] Criar cliente BrasilAPI com timeout.
- [ ] Implementar retry limitado somente para falhas transitórias.
- [ ] Não usar `any` nos payloads externos.
- [ ] Criar upsert idempotente de estados.
- [ ] Criar upsert idempotente de municípios.
- [ ] Desativar registros ausentes sem excluí-los fisicamente.
- [ ] Criar comando `catalogo:geografia:importar`.
- [ ] Permitir importar uma UF específica.
- [ ] Exibir resumo de criados, atualizados, inalterados e falhos.
- [ ] Retornar exit code diferente de zero em falha incompleta.
- [ ] Documentar comando e exemplos no README.
- [ ] Testar respostas inválidas e indisponibilidade da BrasilAPI.
- [ ] Testar idempotência de duas importações.

### Perfil da empresa no tenant

- [ ] Criar modelo singleton `Empresa` no schema tenant.
- [ ] Usar ID inteiro sequencial e `public_id` UUID.
- [ ] Adicionar razão social, nome fantasia e CNPJ normalizado.
- [ ] Adicionar e-mail, telefone e site opcionais.
- [ ] Adicionar CEP, logradouro, número, complemento e bairro.
- [ ] Adicionar código IBGE, município e UF como snapshot.
- [ ] Adicionar `created_at` e `updated_at`.
- [ ] Criar índices necessários para CNPJ e código IBGE.
- [ ] Criar migration tenant separada.
- [ ] Criar `GET /api/v1/empresa`.
- [ ] Criar `PUT /api/v1/empresa`.
- [ ] Restringir atualização ao admin do tenant.
- [ ] Validar e normalizar CNPJ, CEP, telefone e e-mail com helpers.
- [ ] Permitir preenchimento gradual após contratação.
- [ ] Implementar consulta opcional de CEP como sugestão de endereço.
- [ ] Não sobrescrever campos editados sem confirmação.
- [ ] Documentar formulário e estados para o frontend.
- [ ] Atualizar Swagger e referência geral de endpoints.

### Saída

- [ ] Importação geográfica passa em execução limpa.
- [ ] Perfil empresarial permanece isolado no banco tenant.
- [ ] Migrations central e tenant podem ser aplicadas separadamente.
- [ ] Testes, cobertura, lint, typecheck e build aprovados.
- [ ] Branch pronta para integração.

---

## Etapa 13 — Configuração WhatsApp independente por tenant

Branch: `feat/configuracao-whatsapp-tenant`

- [ ] Definir limite de contas por plano.
- [ ] Evoluir `ContaWhatsapp` com WABA ID e número de exibição.
- [ ] Adicionar versão configurável da Graph API.
- [ ] Adicionar status de configuração e data da última validação.
- [ ] Adicionar campos de erro sem expor o token.
- [ ] Adicionar soft delete.
- [ ] Manter token criptografado no banco tenant.
- [ ] Usar chave criptográfica específica de credenciais tenant.
- [ ] Criar migration tenant.
- [ ] Criar listagem de contas sem retornar segredo.
- [ ] Criar detalhe sem retornar segredo.
- [ ] Criar cadastro e atualização de conta.
- [ ] Criar rotação de token.
- [ ] Criar teste de credenciais contra a Graph API.
- [ ] Criar ativação e desativação.
- [ ] Sincronizar `phone_number_id -> tenant` no banco central.
- [ ] Tornar sincronização central idempotente.
- [ ] Compensar falha entre banco tenant e central.
- [ ] Impedir que dois tenants usem o mesmo `phone_number_id`.
- [ ] Validar webhook com a conta correta do tenant.
- [ ] Selecionar conta de saída por conversa.
- [ ] Nunca registrar token em log, erro, auditoria ou response.
- [ ] Criar auditoria de mudanças sem dados secretos.
- [ ] Documentar tela de onboarding manual do WhatsApp.
- [ ] Documentar renovação e diagnóstico de token.
- [ ] Atualizar Swagger e Markdown.
- [ ] Testar isolamento entre duas contas de tenants diferentes.

### Saída

- [ ] Cada tenant administra somente suas contas.
- [ ] Webhook resolve tenant pelo índice técnico central.
- [ ] Credenciais permanecem exclusivamente no banco tenant.
- [ ] Testes, cobertura, lint, typecheck e build aprovados.
- [ ] Branch pronta para integração.

---

## Etapa 14 — Cadastro de usuários e permissões RBAC

Branch: `feat/usuarios-permissoes`

### Modelo e autorização

- [ ] Confirmar matriz de permissões de `ADMIN_TENANT`.
- [ ] Confirmar matriz de permissões de `GESTOR`.
- [ ] Confirmar matriz de permissões de `ATENDENTE`.
- [ ] Criar enum central de papéis necessário.
- [ ] Criar perfil operacional de usuário no banco tenant.
- [ ] Vincular perfil tenant ao `public_id` do usuário central.
- [ ] Adicionar soft delete e timestamps.
- [ ] Criar índices de e-mail, papel, ativo e busca.
- [ ] Criar migrations central e tenant separadas.
- [ ] Criar middleware declarativo de permissão.
- [ ] Negar por padrão permissões desconhecidas.
- [ ] Retornar `403 ACESSO_NEGADO` de forma padronizada.
- [ ] Testar matriz completa por papel.

### CRUD de usuários

- [ ] Criar schema Zod de cadastro.
- [ ] Criar schema Zod de atualização administrativa.
- [ ] Criar listagem paginada com `busca`, papel e status.
- [ ] Criar detalhe por `public_id`.
- [ ] Criar usuário central e perfil tenant idempotentemente.
- [ ] Definir compensação se a escrita em um dos bancos falhar.
- [ ] Impedir e-mail duplicado globalmente.
- [ ] Normalizar e-mail antes de consultar e salvar.
- [ ] Permitir ativar e desativar usuário.
- [ ] Revogar refresh tokens ao desativar.
- [ ] Impedir que admin remova o próprio último acesso administrativo.
- [ ] Implementar soft delete.
- [ ] Criar auditoria das alterações.
- [ ] Nunca retornar `senha_hash`.
- [ ] Criar `GET /api/v1/usuarios`.
- [ ] Criar `POST /api/v1/usuarios`.
- [ ] Criar `GET /api/v1/usuarios/{usuarioId}`.
- [ ] Criar `PUT /api/v1/usuarios/{usuarioId}`.
- [ ] Criar `PATCH /api/v1/usuarios/{usuarioId}/status`.
- [ ] Criar `DELETE /api/v1/usuarios/{usuarioId}`.
- [ ] Atualizar Swagger e documentação de telas.

### Saída

- [ ] Usuários não acessam outro tenant.
- [ ] Backend aplica permissões independentemente do frontend.
- [ ] Falhas entre bancos são recuperáveis e auditáveis.
- [ ] Testes, cobertura, lint, typecheck e build aprovados.
- [ ] Branch pronta para integração.

---

## Etapa 15 — Recuperação e alteração de senha

Branch: `feat/recuperacao-senha`

- [ ] Definir provedor de e-mail e remetente por ambiente.
- [ ] Criar interface de envio de e-mail substituível em testes.
- [ ] Criar modo local que não envia e-mail real.
- [ ] Criar tabela central de tokens de recuperação.
- [ ] Armazenar somente hash do token.
- [ ] Adicionar expiração, consumo, tentativas e timestamps.
- [ ] Indexar hash, usuário e expiração.
- [ ] Criar migration central.
- [ ] Criar token criptograficamente seguro.
- [ ] Invalidar tokens anteriores ao criar um novo.
- [ ] Implementar resposta neutra contra enumeração de e-mails.
- [ ] Aplicar rate limit por IP e identidade normalizada.
- [ ] Criar `POST /api/v1/auth/esqueci-senha`.
- [ ] Criar `POST /api/v1/auth/redefinir-senha`.
- [ ] Validar política de nova senha.
- [ ] Impedir reutilização de token consumido.
- [ ] Revogar todas as sessões após redefinição.
- [ ] Registrar auditoria sem gravar token ou senha.
- [ ] Documentar telas de solicitação, sucesso, expirado e inválido.
- [ ] Testar expiração, replay, concorrência e enumeração.
- [ ] Atualizar Swagger e Markdown.

### Saída

- [ ] Token nunca aparece em logs nem no banco em texto puro.
- [ ] Respostas não revelam se o e-mail existe.
- [ ] Sessões antigas deixam de funcionar após redefinição.
- [ ] Testes, cobertura, lint, typecheck e build aprovados.
- [ ] Branch pronta para integração.

---

## Etapa 16 — Setores e vínculos de atendentes

Branch: `feat/setores-atendentes`

- [ ] Substituir `Atendente.setor_id` por relação N:N.
- [ ] Criar tabela de vínculo com ID inteiro e timestamps.
- [ ] Garantir unicidade atendente-setor.
- [ ] Criar índices para filas por setor e setores do atendente.
- [ ] Criar migration tenant preservando vínculos existentes.
- [ ] Criar CRUD de setores com soft delete.
- [ ] Impedir exclusão lógica de setor usado por fluxo publicado.
- [ ] Definir comportamento para setor com conversa ativa.
- [ ] Criar listagem de atendentes elegíveis.
- [ ] Criar endpoint para substituir vínculos de setores atomicamente.
- [ ] Validar que todos os setores pertencem ao tenant atual.
- [ ] Restringir gestão a admin/gestor conforme RBAC.
- [ ] Criar `GET /api/v1/setores`.
- [ ] Criar `POST /api/v1/setores`.
- [ ] Criar `GET /api/v1/setores/{setorId}`.
- [ ] Criar `PUT /api/v1/setores/{setorId}`.
- [ ] Criar `DELETE /api/v1/setores/{setorId}`.
- [ ] Criar `PUT /api/v1/usuarios/{usuarioId}/setores`.
- [ ] Documentar telas, seletores e estados vazios.
- [ ] Testar acesso de atendente a um, vários e nenhum setor.
- [ ] Atualizar Swagger e Markdown.

### Saída

- [ ] Relação N:N preserva dados existentes.
- [ ] Atendente comum só enxerga setores vinculados.
- [ ] Nós publicados não ficam com setor inexistente.
- [ ] Testes, cobertura, lint, typecheck e build aprovados.
- [ ] Branch pronta para integração.

---

## Etapa 17 — Dados do usuário autenticado

Branch: `feat/perfil-usuario-logado`

- [ ] Definir campos editáveis pelo próprio usuário.
- [ ] Separar campos editáveis de papel, status e permissões.
- [ ] Criar `GET /api/v1/me`.
- [ ] Retornar perfil, tenant, papel, permissões e setores.
- [ ] Criar `PUT /api/v1/me` para nome e dados pessoais permitidos.
- [ ] Criar `PUT /api/v1/me/senha` com senha atual.
- [ ] Validar senha atual antes da alteração.
- [ ] Revogar outras sessões após alteração de senha.
- [ ] Definir fluxo separado para alteração de e-mail.
- [ ] Exigir reautenticação para ações sensíveis.
- [ ] Sincronizar nome central e perfil tenant idempotentemente.
- [ ] Criar upload de avatar somente após definir storage.
- [ ] Não armazenar binário de avatar no PostgreSQL.
- [ ] Documentar tela de perfil, segurança e sessões.
- [ ] Atualizar Swagger e Markdown.
- [ ] Testar que usuário não altera papel ou permissões.

### Saída

- [ ] Perfil retorna permissões efetivas para compor o frontend.
- [ ] Campos administrativos não são alteráveis pelo usuário.
- [ ] Alteração de senha invalida sessões conforme contrato.
- [ ] Testes, cobertura, lint, typecheck e build aprovados.
- [ ] Branch pronta para integração.

---

## Etapa 18 — Histórico de contatos, conversas e mensagens

Branch: `feat/historico-conversas`

- [ ] Alinhar enum para `BOT`, `AGUARDANDO_ATENDENTE`, `COM_ATENDENTE` e `ENCERRADA`.
- [ ] Criar migration tenant preservando estados existentes.
- [ ] Adicionar snapshot do estado do fluxo na conversa.
- [ ] Adicionar direção e autor explícitos na mensagem.
- [ ] Diferenciar contato, bot, atendente e sistema.
- [ ] Adicionar status de entrega, leitura e falha.
- [ ] Adicionar referência de resposta e mídia quando necessário.
- [ ] Criar índices para fila, minhas conversas e histórico.
- [ ] Garantir unicidade de mensagem WhatsApp para idempotência.
- [ ] Persistir mensagens recebidas pelo worker.
- [ ] Criar/atualizar contato por telefone normalizado.
- [ ] Criar/retomar conversa conforme regra de janela.
- [ ] Criar listagem paginada de contatos.
- [ ] Criar listagem paginada de conversas.
- [ ] Filtrar por status, setor, atendente, conta e busca.
- [ ] Aplicar escopo de setores conforme permissão.
- [ ] Criar detalhe da conversa.
- [ ] Criar histórico paginado com cursor temporal estável.
- [ ] Definir ordem e prevenção de mensagens duplicadas no frontend.
- [ ] Criar `GET /api/v1/contatos`.
- [ ] Criar `GET /api/v1/conversas`.
- [ ] Criar `GET /api/v1/conversas/{conversaId}`.
- [ ] Criar `GET /api/v1/conversas/{conversaId}/mensagens`.
- [ ] Documentar lista, filtros, timeline e paginação reversa.
- [ ] Atualizar Swagger e Markdown.

### Saída

- [ ] Histórico é persistente e ordenado deterministicamente.
- [ ] Atendente não consulta conversa fora dos seus setores.
- [ ] Reentrega de webhook não duplica contato, conversa ou mensagem.
- [ ] Testes, cobertura, lint, typecheck e build aprovados.
- [ ] Branch pronta para integração.

---

## Etapa 19 — Direcionamento, fila e claim de atendente

Branch: `feat/direcionamento-atendimento`

- [ ] Integrar saída `direcionar_setor` com conversa persistida.
- [ ] Mudar estado para `AGUARDANDO_ATENDENTE`.
- [ ] Registrar setor de destino e evento de sistema.
- [ ] Criar visão de fila por setor.
- [ ] Criar visão “minhas conversas”.
- [ ] Implementar claim com `UPDATE` condicional atômico.
- [ ] Validar vínculo ativo do atendente com o setor.
- [ ] Retornar conflito quando outro atendente assumir primeiro.
- [ ] Criar reatribuição manual para admin/gestor.
- [ ] Registrar autor, origem, destino, motivo e data.
- [ ] Criar encerramento da conversa.
- [ ] Definir opção de devolver ao bot.
- [ ] Restaurar snapshot correto ao devolver ao bot.
- [ ] Criar `POST /api/v1/conversas/{conversaId}/assumir`.
- [ ] Criar `POST /api/v1/conversas/{conversaId}/reatribuir`.
- [ ] Criar `POST /api/v1/conversas/{conversaId}/encerrar`.
- [ ] Testar corrida entre dois atendentes.
- [ ] Testar claim fora do setor.
- [ ] Testar reatribuição e auditoria.
- [ ] Documentar fila, confirmações e tratamento de conflito.
- [ ] Atualizar Swagger e Markdown.

### Saída

- [ ] Apenas um atendente vence o claim.
- [ ] Permissões e setores limitam fila e ações.
- [ ] Toda transferência possui trilha persistente.
- [ ] Testes, cobertura, lint, typecheck e build aprovados.
- [ ] Branch pronta para integração.

---

## Etapa 20 — Mensagens de atendimento e WhatsApp Cloud API

Branch: `feat/mensagens-whatsapp`

- [ ] Criar cliente HTTP da Graph API com timeout.
- [ ] Selecionar token e versão da conta do tenant.
- [ ] Criar contrato interno de mensagem de saída.
- [ ] Enfileirar envio sem bloquear a API.
- [ ] Persistir mensagem antes do envio com status pendente.
- [ ] Atualizar status com resposta da Meta.
- [ ] Processar webhooks de enviada, entregue, lida e falha.
- [ ] Garantir idempotência de envio e status.
- [ ] Implementar retry somente para falhas transitórias.
- [ ] Não repetir falhas permanentes de template/janela.
- [ ] Respeitar janela de atendimento do WhatsApp.
- [ ] Bloquear envio manual sem atendente responsável.
- [ ] Criar `POST /api/v1/conversas/{conversaId}/mensagens`.
- [ ] Validar texto e tipos de mídia suportados no MVP.
- [ ] Nunca expor token da conta em erros.
- [ ] Registrar correlation ID e IDs da Meta.
- [ ] Criar fake da Graph API para testes.
- [ ] Documentar estados pendente, enviado, entregue, lido e falho.
- [ ] Atualizar Swagger e Markdown.

### Saída

- [ ] Conta correta é usada para cada tenant/conversa.
- [ ] Retry não duplica mensagem no WhatsApp.
- [ ] Histórico reflete estados recebidos da Meta.
- [ ] Testes, cobertura, lint, typecheck e build aprovados.
- [ ] Branch pronta para integração.

---

## Etapa 21 — Tela de chat e tempo real

Branch: `feat/chat-atendimento`

- [ ] Adicionar Socket.io ao servidor HTTP existente.
- [ ] Autenticar handshake com JWT tenant.
- [ ] Resolver tenant sem aceitar subdomínio.
- [ ] Criar rooms namespacadas por tenant, setor e conversa.
- [ ] Autorizar entrada em room conforme RBAC e vínculo de setor.
- [ ] Criar evento `conversa:nova_na_fila`.
- [ ] Criar evento `conversa:assumida`.
- [ ] Criar evento `conversa:atualizada`.
- [ ] Criar evento `conversa:mensagem_recebida`.
- [ ] Criar evento `conversa:mensagem_atualizada`.
- [ ] Criar evento `atendente:presenca`.
- [ ] Persistir mensagens antes de emitir evento.
- [ ] Usar REST como fonte de recuperação após reconexão.
- [ ] Implementar presença no Redis com TTL.
- [ ] Tratar múltiplas abas e desconexão abrupta.
- [ ] Definir paginação inicial e carregamento de mensagens antigas.
- [ ] Documentar ordem, payload e reconexão de cada evento.
- [ ] Criar `docs/eventos/websocket.md`.
- [ ] Documentar composição da fila, painel e chat.
- [ ] Testar isolamento de rooms entre tenants.
- [ ] Testar autorização por setor.
- [ ] Testar reconexão sem perda permanente de histórico.
- [ ] Atualizar Swagger das rotas REST e Markdown.

### Saída

- [ ] Evento de um tenant nunca chega a outro tenant.
- [ ] Atualização em tempo real converge com a API REST.
- [ ] Presença expira sem deixar usuário online indefinidamente.
- [ ] Testes, cobertura, lint, typecheck e build aprovados.
- [ ] Branch pronta para integração.

## Backlog posterior

- distribuição automática round-robin ou menor carga;
- múltiplos perfis customizados pelo tenant;
- convites com aceite antes da ativação;
- templates oficiais do WhatsApp;
- upload e antivírus de anexos;
- busca textual avançada no histórico;
- exportação de conversas e relatórios;
- retenção configurável e anonimização LGPD;
- avatar após escolha do storage de objetos.

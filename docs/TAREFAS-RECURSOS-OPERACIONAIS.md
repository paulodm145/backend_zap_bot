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

| Etapa                                | Branch                               | Dependência    | Estado    |
| ------------------------------------ | ------------------------------------ | -------------- | --------- |
| 00. Planejamento e decisões          | `docs/backlog-recursos-operacionais` | Estrutura base | Concluída |
| 12. Catálogo geográfico e empresa    | `feat/cadastro-empresa-geografia`    | 00             | Concluída |
| 13. Configuração WhatsApp por tenant | `feat/configuracao-whatsapp-tenant`  | 00 e 12        | Concluída |
| 14. Usuários e RBAC                  | `feat/usuarios-permissoes`           | 00             | Concluída |
| 15. Recuperação de senha             | `feat/recuperacao-senha`             | 14             | Concluída |
| 16. Setores e vínculos de atendentes | `feat/setores-atendentes`            | 14             | Concluída |
| 17. Perfil do usuário autenticado    | `feat/perfil-usuario-logado`         | 14             | Concluída |
| 18. Histórico de conversas           | `feat/historico-conversas`           | 13 e 16        | Pendente  |
| 19. Direcionamento e claim           | `feat/direcionamento-atendimento`    | 16 e 18        | Pendente  |
| 20. Mensagens e Cloud API            | `feat/mensagens-whatsapp`            | 13, 18 e 19    | Pendente  |
| 21. Chat em tempo real               | `feat/chat-atendimento`              | 19 e 20        | Pendente  |

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
- [x] Revisar e aprovar este backlog com o responsável pelo produto.
- [x] Marcar esta etapa como concluída.

---

## Etapa 12 — Catálogo geográfico e cadastro da empresa

Branch: `feat/cadastro-empresa-geografia`

### Catálogo central

- [x] Criar modelo central `Estado` com ID inteiro, código IBGE e sigla única.
- [x] Criar modelo central `Municipio` com ID inteiro e código IBGE único.
- [x] Relacionar município ao estado.
- [x] Adicionar `created_at` e `updated_at`.
- [x] Criar índices por sigla, nome normalizado, estado e código IBGE.
- [x] Criar migration central separada.
- [x] Criar schemas Zod para respostas externas de UF.
- [x] Criar schemas Zod para respostas externas de municípios.
- [x] Criar cliente BrasilAPI com timeout.
- [x] Implementar retry limitado somente para falhas transitórias.
- [x] Não usar `any` nos payloads externos.
- [x] Criar upsert idempotente de estados.
- [x] Criar upsert idempotente de municípios.
- [x] Desativar registros ausentes sem excluí-los fisicamente.
- [x] Criar comando `catalogo:geografia:importar`.
- [x] Permitir importar uma UF específica.
- [x] Exibir resumo de criados, atualizados, inalterados e falhos.
- [x] Retornar exit code diferente de zero em falha incompleta.
- [x] Documentar comando e exemplos no README.
- [x] Testar respostas inválidas e indisponibilidade da BrasilAPI.
- [x] Testar idempotência de duas importações.

### Perfil da empresa no tenant

- [x] Criar modelo singleton `Empresa` no schema tenant.
- [x] Usar ID inteiro sequencial e `public_id` UUID.
- [x] Adicionar razão social, nome fantasia e CNPJ normalizado.
- [x] Adicionar e-mail, telefone e site opcionais.
- [x] Adicionar CEP, logradouro, número, complemento e bairro.
- [x] Adicionar código IBGE, município e UF como snapshot.
- [x] Adicionar `created_at` e `updated_at`.
- [x] Criar índices necessários para CNPJ e código IBGE.
- [x] Criar migration tenant separada.
- [x] Criar `GET /api/v1/empresa`.
- [x] Criar `PUT /api/v1/empresa`.
- [x] Restringir atualização ao admin do tenant.
- [x] Validar e normalizar CNPJ, CEP, telefone e e-mail com helpers.
- [x] Permitir preenchimento gradual após contratação.
- [x] Implementar consulta opcional de CEP como sugestão de endereço.
- [x] Não sobrescrever campos editados sem confirmação.
- [x] Documentar formulário e estados para o frontend.
- [x] Atualizar Swagger e referência geral de endpoints.

### Saída

- [x] Importação geográfica passa em execução limpa.
- [x] Perfil empresarial permanece isolado no banco tenant.
- [x] Migrations central e tenant podem ser aplicadas separadamente.
- [x] Testes, cobertura, lint, typecheck e build aprovados.
- [x] Branch pronta para integração.

---

## Etapa 13 — Configuração WhatsApp independente por tenant

Branch: `feat/configuracao-whatsapp-tenant`

- [x] Definir limite de contas por plano.
- [x] Evoluir `ContaWhatsapp` com WABA ID e número de exibição.
- [x] Adicionar versão configurável da Graph API.
- [x] Adicionar status de configuração e data da última validação.
- [x] Adicionar campos de erro sem expor o token.
- [x] Adicionar soft delete.
- [x] Manter token criptografado no banco tenant.
- [x] Usar chave criptográfica específica de credenciais tenant.
- [x] Criar migration tenant.
- [x] Criar listagem de contas sem retornar segredo.
- [x] Criar detalhe sem retornar segredo.
- [x] Criar cadastro e atualização de conta.
- [x] Criar rotação de token.
- [x] Criar teste de credenciais contra a Graph API.
- [x] Criar ativação e desativação.
- [x] Sincronizar `phone_number_id -> tenant` no banco central.
- [x] Tornar sincronização central idempotente.
- [x] Compensar falha entre banco tenant e central.
- [x] Impedir que dois tenants usem o mesmo `phone_number_id`.
- [x] Validar webhook com a conta correta do tenant.
- [x] Selecionar conta de saída por conversa.
- [x] Nunca registrar token em log, erro, auditoria ou response.
- [x] Criar auditoria de mudanças sem dados secretos.
- [x] Documentar tela de onboarding manual do WhatsApp.
- [x] Documentar renovação e diagnóstico de token.
- [x] Atualizar Swagger e Markdown.
- [x] Testar isolamento entre duas contas de tenants diferentes.

### Saída

- [x] Cada tenant administra somente suas contas.
- [x] Webhook resolve tenant pelo índice técnico central.
- [x] Credenciais permanecem exclusivamente no banco tenant.
- [x] Testes, cobertura, lint, typecheck e build aprovados.
- [x] Branch pronta para integração.

---

## Etapa 14 — Cadastro de usuários e permissões RBAC

Branch: `feat/usuarios-permissoes`

### Modelo e autorização

- [x] Confirmar matriz de permissões de `ADMIN_TENANT`.
- [x] Confirmar matriz de permissões de `GESTOR`.
- [x] Confirmar matriz de permissões de `ATENDENTE`.
- [x] Criar enum central de papéis necessário.
- [x] Criar perfil operacional de usuário no banco tenant.
- [x] Vincular perfil tenant ao `public_id` do usuário central.
- [x] Adicionar soft delete e timestamps.
- [x] Criar índices de e-mail, papel, ativo e busca.
- [x] Criar migrations central e tenant separadas.
- [x] Criar middleware declarativo de permissão.
- [x] Negar por padrão permissões desconhecidas.
- [x] Retornar `403 ACESSO_NEGADO` de forma padronizada.
- [x] Testar matriz completa por papel.

### CRUD de usuários

- [x] Criar schema Zod de cadastro.
- [x] Criar schema Zod de atualização administrativa.
- [x] Criar listagem paginada com `busca`, papel e status.
- [x] Criar detalhe por `public_id`.
- [x] Criar usuário central e perfil tenant idempotentemente.
- [x] Definir compensação se a escrita em um dos bancos falhar.
- [x] Impedir e-mail duplicado globalmente.
- [x] Normalizar e-mail antes de consultar e salvar.
- [x] Permitir ativar e desativar usuário.
- [x] Revogar refresh tokens ao desativar.
- [x] Impedir que admin remova o próprio último acesso administrativo.
- [x] Implementar soft delete.
- [x] Criar auditoria das alterações.
- [x] Nunca retornar `senha_hash`.
- [x] Criar `GET /api/v1/usuarios`.
- [x] Criar `POST /api/v1/usuarios`.
- [x] Criar `GET /api/v1/usuarios/{usuarioId}`.
- [x] Criar `PUT /api/v1/usuarios/{usuarioId}`.
- [x] Criar `PATCH /api/v1/usuarios/{usuarioId}/status`.
- [x] Criar `DELETE /api/v1/usuarios/{usuarioId}`.
- [x] Atualizar Swagger e documentação de telas.

### Saída

- [x] Usuários não acessam outro tenant.
- [x] Backend aplica permissões independentemente do frontend.
- [x] Falhas entre bancos são recuperáveis e auditáveis.
- [x] Testes, cobertura, lint, typecheck e build aprovados.
- [x] Branch pronta para integração.

---

## Etapa 15 — Recuperação e alteração de senha — Concluída

Branch: `feat/recuperacao-senha`

- [x] Definir provedor de e-mail e remetente por ambiente.
- [x] Criar interface de envio de e-mail substituível em testes.
- [x] Criar modo local que não envia e-mail real.
- [x] Criar tabela central de tokens de recuperação.
- [x] Armazenar somente hash do token.
- [x] Adicionar expiração, consumo, tentativas e timestamps.
- [x] Indexar hash, usuário e expiração.
- [x] Criar migration central.
- [x] Criar token criptograficamente seguro.
- [x] Invalidar tokens anteriores ao criar um novo.
- [x] Implementar resposta neutra contra enumeração de e-mails.
- [x] Aplicar rate limit por IP e identidade normalizada.
- [x] Criar `POST /api/v1/auth/esqueci-senha`.
- [x] Criar `POST /api/v1/auth/redefinir-senha`.
- [x] Validar política de nova senha.
- [x] Impedir reutilização de token consumido.
- [x] Revogar todas as sessões após redefinição.
- [x] Registrar auditoria sem gravar token ou senha.
- [x] Documentar telas de solicitação, sucesso, expirado e inválido.
- [x] Testar expiração, replay, concorrência e enumeração.
- [x] Atualizar Swagger e Markdown.

### Saída

- [x] Token nunca aparece em logs nem no banco em texto puro.
- [x] Respostas não revelam se o e-mail existe.
- [x] Sessões antigas deixam de funcionar após redefinição.
- [x] Testes, cobertura, lint, typecheck e build aprovados.
- [x] Branch pronta para integração.

---

## Etapa 16 — Setores e vínculos de atendentes — Concluída

Branch: `feat/setores-atendentes`

- [x] Substituir `Atendente.setor_id` por relação N:N.
- [x] Criar tabela de vínculo com ID inteiro e timestamps.
- [x] Garantir unicidade atendente-setor.
- [x] Criar índices para filas por setor e setores do atendente.
- [x] Criar migration tenant preservando vínculos existentes.
- [x] Criar CRUD de setores com soft delete.
- [x] Impedir exclusão lógica de setor usado por fluxo publicado.
- [x] Definir comportamento para setor com conversa ativa.
- [x] Criar listagem de atendentes elegíveis.
- [x] Criar endpoint para substituir vínculos de setores atomicamente.
- [x] Validar que todos os setores pertencem ao tenant atual.
- [x] Restringir gestão a admin/gestor conforme RBAC.
- [x] Criar `GET /api/v1/setores`.
- [x] Criar `POST /api/v1/setores`.
- [x] Criar `GET /api/v1/setores/{setorId}`.
- [x] Criar `PUT /api/v1/setores/{setorId}`.
- [x] Criar `DELETE /api/v1/setores/{setorId}`.
- [x] Criar `PUT /api/v1/usuarios/{usuarioId}/setores`.
- [x] Documentar telas, seletores e estados vazios.
- [x] Testar acesso de atendente a um, vários e nenhum setor.
- [x] Atualizar Swagger e Markdown.

### Saída

- [x] Relação N:N preserva dados existentes.
- [x] Atendente comum só enxerga setores vinculados.
- [x] Nós publicados não ficam com setor inexistente.
- [x] Testes, cobertura, lint, typecheck e build aprovados.
- [x] Branch pronta para integração.

---

## Etapa 17 — Dados do usuário autenticado — Concluída

Branch: `feat/perfil-usuario-logado`

- [x] Definir campos editáveis pelo próprio usuário.
- [x] Separar campos editáveis de papel, status e permissões.
- [x] Criar `GET /api/v1/me`.
- [x] Retornar perfil, tenant, papel, permissões e setores.
- [x] Criar `PUT /api/v1/me` para nome e dados pessoais permitidos.
- [x] Criar `PUT /api/v1/me/senha` com senha atual.
- [x] Validar senha atual antes da alteração.
- [x] Revogar outras sessões após alteração de senha.
- [x] Definir fluxo separado para alteração de e-mail.
- [x] Exigir reautenticação para ações sensíveis.
- [x] Sincronizar nome central e perfil tenant idempotentemente.
- [x] Adiar upload de avatar até definir storage.
- [x] Não armazenar binário de avatar no PostgreSQL.
- [x] Documentar tela de perfil, segurança e sessões.
- [x] Atualizar Swagger e Markdown.
- [x] Testar que usuário não altera papel ou permissões.

### Saída

- [x] Perfil retorna permissões efetivas para compor o frontend.
- [x] Campos administrativos não são alteráveis pelo usuário.
- [x] Alteração de senha invalida sessões conforme contrato.
- [x] Testes, cobertura, lint, typecheck e build aprovados.
- [x] Branch pronta para integração.

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

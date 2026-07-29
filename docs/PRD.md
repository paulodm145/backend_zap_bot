# PRD — Plataforma de Automação de WhatsApp com IA e Editor Visual de Fluxos

> Documento canônico de produto deste repositório.

**Autor:** Paulo Roberto
**Versão:** 1.0 (MVP)
**Data:** Julho/2026
**Status:** Em elaboração

---

## 1. Resumo executivo

Plataforma SaaS que permite a negócios criar e gerenciar assistentes de atendimento no WhatsApp através de um **editor visual de fluxos** (estilo URA), combinando lógica condicional tradicional com **nós de Inteligência Artificial** (LangChain) e **integrações com sistemas externos** (ERPs, CRMs, APIs de terceiros). O usuário final desenha o comportamento do bot sem escrever código.

O produto compete no espaço de ferramentas como Typebot, Landbot e ManyChat, diferenciando-se pelo foco em **IA nativa no fluxo** e **integrações com ERPs brasileiros** desde o desenho inicial.

---

## 2. Problema

- Pequenas e médias empresas usam WhatsApp como canal principal de atendimento, mas dependem de atendimento 100% manual ou de bots rígidos (árvore de decisão fixa, sem IA).
- Ferramentas internacionais de flow builder (Typebot, Landbot) não têm integrações nativas com ERPs/sistemas usados no Brasil (Omie, Bling, ContaAzul) e cobram em dólar.
- Configurar IA (LLM) em um fluxo de atendimento hoje exige conhecimento técnico (API, prompt engineering, código) — inacessível para o dono de um pequeno negócio.

## 3. Objetivo do produto

Permitir que um usuário sem conhecimento técnico monte, em minutos, um fluxo de atendimento no WhatsApp que:
1. Responde perguntas comuns automaticamente,
2. Usa IA para lidar com perguntas abertas ou não previstas no fluxo,
3. Consulta sistemas externos (ERP, planilha, API) para trazer dados reais ao cliente (status de pedido, estoque, etc.),
4. Transfere para atendimento humano quando necessário.

## 4. Público-alvo (personas)

| Persona | Descrição | Necessidade principal |
|---|---|---|
| Pequeno lojista / prestador de serviço | Sem equipe técnica, atende pelo WhatsApp pessoal ou Business | Automatizar perguntas frequentes (horário, preço, status) |
| PME com ERP já implantado | Já usa Omie/Bling/sistema próprio | Bot que consulta pedidos, estoque, boletos direto no ERP |
| Agência de marketing/automação | Gerencia WhatsApp de múltiplos clientes | Multi-tenant, gestão centralizada de vários bots |

**Persona primária do MVP:** PME com ERP já implantado — é o segmento com maior disposição a pagar e onde a integração ERP é diferencial competitivo real.

## 5. Escopo do MVP

### 5.1 Editor visual de fluxo
- Canvas drag-and-drop (React Flow) para desenhar o fluxo de conversa.
- Tipos de nó no MVP:
  1. **Mensagem** — texto/mídia (imagem, PDF, áudio)
  2. **Captura de resposta** — salva resposta do usuário em variável
  3. **Condição** — ramificação if/else baseada em variável/resposta
  4. **Nó de IA** — chama LLM (LangChain) com prompt configurável, contexto e memória de conversa
  5. **Integração HTTP** — chamada a API externa (ERP, CRM, webhook genérico) com autenticação configurável (API Key, Bearer, Basic, OAuth2 client credentials), mapeamento de resposta via JSONPath, e saída dupla (sucesso/falha)
  6. **Direcionar para setor** — encerra a automação e envia a conversa para a fila de um setor/time específico (ex: Fiscal, Financeiro, DP), definido pelo desenhista do fluxo. Pode ser acionado por menu explícito (cliente escolhe opção) ou pela saída do nó de IA (classificação de intenção)
- Salvar/versionar fluxos (rascunho vs publicado).
- Teste do fluxo dentro da própria plataforma (simulador de conversa) antes de publicar.

### 5.2 Motor de execução
- Interpreta o JSON do fluxo publicado.
- Mantém estado da conversa por contato (nó atual, variáveis capturadas) no Redis.
- Processa mensagens recebidas de forma assíncrona via fila (BullMQ), desacoplando o webhook do processamento.

### 5.3 Integração com WhatsApp
- Conexão via **WhatsApp Cloud API oficial** (não Tech Provider no MVP — onboarding manual por cliente).
- Recebimento e envio de mensagens (texto, mídia, template).
- Suporte a variáveis de contexto (nome do contato, telefone, etc.).

### 5.4 Multi-tenant
- Cada cliente (tenant) tem: seu próprio WABA/número, seus fluxos, seus contatos, suas credenciais de integração (armazenadas criptografadas, isoladas por tenant).
- Painel do tenant: métricas básicas (conversas no mês, taxa de resposta da IA, custo estimado de IA consumido).

### 5.5 IA / LangChain
- Nó de IA configurável com: prompt de sistema, modelo (custo-benefício por padrão, ex. Haiku), memória de conversa por contato.
- Cache de respostas frequentes (Redis) para reduzir custo de token.
- Fallback: se a IA não conseguir responder com confiança, transferir para humano.

### 5.6 Integrações externas (ERP/CRM)
- Nó genérico de integração HTTP (ver 5.1).
- Armazenamento seguro de credenciais por tenant.
- Sem presets prontos de ERP específico no MVP (roadmap futuro, conforme demanda validada).

### 5.7 Painel web de atendimento, setores e distribuição de conversas

Caso de uso motivador: tenant com múltiplos setores internos (ex: escritório de contabilidade com Fiscal, Financeiro, DP, Societário), onde cada conversa transferida do bot precisa cair no setor correto, não numa fila única.

**Cadastro de setores (times)**
- Tenant cria setores livremente (ex: Fiscal, Financeiro, DP).
- Atendentes são vinculados a um ou mais setores.
- Admin do tenant enxerga e gerencia todos os setores; atendente comum só vê a fila do(s) setor(es) que pertence.

**Distribuição de conversas**
- Estratégia do MVP: **fila + claim manual** dentro do setor de destino (evita disputa entre atendentes sem precisar de lock complexo — via `UPDATE` condicional atômico: só um atendente consegue assumir uma conversa sem dono).
- Round-robin / menor-carga (distribuição automática dentro do setor) fica como evolução pós-MVP, se o volume justificar.

**Fluxo de transferência**
1. Bot identifica necessidade de humano (via menu explícito escolhido pelo cliente ou classificação de intenção pelo nó de IA).
2. Nó "Direcionar para setor" define para qual time a conversa vai.
3. Conversa muda de status (`bot` → `aguardando_atendente`) e fica visível na fila do setor correspondente.
4. Atendente do setor assume a conversa (claim atômico); status muda para `com_atendente`.
5. Atendente conversa em tempo real (WebSocket) com contexto completo do que o bot já capturou (variáveis do fluxo, histórico).
6. Atendente encerra a conversa ou devolve ao bot.

**Requisitos mínimos do painel**
- Lista de conversas segmentada por setor (fila do setor, minhas conversas, encerradas).
- Chat em tempo real (WebSocket).
- Visualização do contexto/histórico capturado pelo bot antes da transferência.
- Indicador de presença do atendente (online/ausente).
- Visão consolidada de todos os setores para o admin do tenant, com possibilidade de reatribuição manual.

### 5.8 Contratação de planos e provisionamento de tenants

**MVP (fase 1) — onboarding manual**: novos tenants são criados diretamente por você (dono do SaaS) através do painel administrativo interno (seção 5.9). Cobrança acontece fora do sistema (Pix/boleto avulso), sem cobrança recorrente automatizada. Objetivo: validar o produto com os primeiros clientes sem investir em esteira de billing antes de necessário.

**Fase 2 — cadastro self-service**: tela pública de contratação (escolha de plano → cadastro → pagamento), com gateway de pagamento processando assinatura recorrente automaticamente (candidato natural: Pagar.me, já usado em outro projeto do autor) e webhook atualizando status do tenant (ativo/inadimplente/cancelado) sem intervenção manual.

**Provisionamento técnico** (necessário em ambas as fases): ao criar um tenant, o sistema precisa, de forma automatizada:
1. Criar o registro em `central_db.tenants`.
2. Criar o banco de dados físico do tenant e rodar as migrations nele (alinhado com a decisão de banco por tenant).
3. Criar o primeiro usuário administrador do tenant em `central_db.users`.
4. Enviar convite/credencial inicial de acesso.

### 5.9 Painel administrativo interno (visão do dono do SaaS)

Ambiente separado do painel de cada tenant, acessível somente à equipe operadora do SaaS (você). Funcionalidades mínimas do MVP:
- Listar, criar, suspender e editar tenants (nome, plano, status).
- Visualizar consumo agregado por tenant (IA, mensageria) — usando os dados de `usage_logs` de cada banco de tenant.
- Alterar plano de um tenant manualmente.
- Visão de saúde geral da plataforma (nº de tenants ativos, uso de infraestrutura).

## 6. Fora de escopo (MVP)

- Tech Provider / Embedded Signup (onboarding self-service de números) — fase 2.
- Presets de integração com ERPs específicos (Omie, Bling etc.) — fase 2, após validar demanda.
- Campanhas de disparo em massa (marketing/broadcast) — fase 2.
- Múltiplos agentes humanos com fila de atendimento (inbox compartilhado) — fase 2.
- App mobile — não previsto.
- Relatórios avançados / BI — fase 2.

## 7. Requisitos não funcionais

| Categoria | Requisito |
|---|---|
| Custo de infraestrutura | Operar em VPS único (sem AWS) até volume que justifique migração |
| Segurança | Credenciais de tenant criptografadas em repouso; isolamento de dados entre tenants |
| Disponibilidade | Aceitável single-node no MVP; sem SLA formal nesta fase |
| Performance | Resposta ao webhook do WhatsApp em <1s (processamento pesado vai para fila) |
| Custo de mensageria | Priorizar respostas dentro da janela de 24h; alertar tenant sobre uso de mensagens fora da janela (custo extra) |
| Observabilidade | Log de custo de IA e de mensageria por tenant, para billing e alerta de anomalia |

## 8. Arquitetura técnica (resumo)

- **Frontend:** Vercel (React/Next.js), editor de fluxo com React Flow
- **Backend:** Node.js + Express + TypeScript, rodando em VPS via PM2/Docker
- **Banco de dados:** PostgreSQL (JSONB para fluxos, caminho aberto para pgvector futuro)
- **Cache / estado de sessão:** Redis
- **Filas:** BullMQ (sobre o mesmo Redis)
- **IA:** LangChain.js + AWS Bedrock (ou API direta Anthropic/OpenAI)
- **WhatsApp:** Cloud API oficial (Meta), onboarding manual por tenant
- **Monitoramento de filas:** Bull Board
- **Proxy/SSL:** NGINX + certbot

## 9. Modelo de dados (alto nível)

- `tenants` — dados da conta/cliente
- `whatsapp_accounts` — WABA/número vinculado a cada tenant
- `flows` — JSON do fluxo, versão, status (rascunho/publicado)
- `flow_nodes` (ou embutido no JSON) — nós e conexões
- `contacts` — contatos do WhatsApp por tenant
- `teams` — setores/times cadastrados pelo tenant (ex: Fiscal, Financeiro, DP)
- `agents` — atendentes humanos do tenant (nome, email, status online)
- `agent_teams` — vínculo N:N entre atendentes e setores
- `conversations` — conversa por contato; status (`bot`, `aguardando_atendente`, `com_atendente`, `encerrada`), `team_id` (setor de destino), `assigned_agent_id` (claim atômico)
- `conversation_sessions` — estado atual da conversa no bot (nó atual, variáveis) — Redis + snapshot em Postgres
- `conversation_messages` — histórico de mensagens trocadas, com remetente (contato/bot/agente)
- `tenant_credentials` — credenciais de integrações externas, criptografadas
- `usage_logs` — consumo de IA e mensageria por tenant (para billing)

## 10. Modelo de negócio / precificação (referência)

| Tier | Preço (referência) | Limite |
|---|---|---|
| Free | R$0 | ~200 conversas/mês, 1 fluxo, marca d'água |
| Starter | R$79-149/mês | ~2.000 conversas, 1 número |
| Pro | R$249-399/mês | ~10.000 conversas, múltiplos fluxos, IA incluída |
| Enterprise | Sob consulta | Volume alto, múltiplos números, suporte dedicado |

IA e mensageria fora da janela de 24h embutidas no preço até um limite razoável; excedente vira cobrança adicional ou trava de uso.

## 11. Métricas de sucesso do MVP

- Nº de tenants ativos com pelo menos 1 fluxo publicado
- Nº de conversas processadas automaticamente sem intervenção humana
- Taxa de conversas resolvidas pela IA sem transferência humana
- Custo médio de infraestrutura + IA por tenant (para validar margem)
- Ao menos 1 tenant usando o nó de integração com ERP em produção

## 12. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Custo de LLM sobe com volume | Cache de respostas, modelo custo-benefício por padrão, monitoramento por tenant |
| Bloqueio/qualidade baixa do número WhatsApp do cliente | Orientar tenant sobre boas práticas (opt-in, não enviar fora da janela sem necessidade) |
| VPS único como ponto único de falha | Backup automatizado (snapshot + dump do banco), plano de migração documentado |
| Cliente pedir integração de ERP não suportada | Nó genérico HTTP cobre a maioria dos casos até criar preset dedicado |
| Limite de onboarding sem Tech Provider (processo manual) | Aceitável no MVP; revisitar quando houver fila de espera de clientes |

## 13. Roadmap pós-MVP

1. Presets de integração com ERPs mais pedidos (Omie, Bling, ContaAzul)
2. Virar Tech Provider Meta + Embedded Signup (onboarding self-service)
3. Cadastro self-service de tenants com gateway de pagamento e cobrança recorrente automatizada
4. Distribuição automática de conversas dentro do setor (round-robin / menor-carga), além do claim manual
5. Campanhas/broadcast de mensagens (marketing)
6. Relatórios e analytics avançados
7. Migração de infraestrutura conforme volume (VPS → cloud gerenciada) se necessário

---

**Próximos passos imediatos:** validar este PRD, iniciar modelagem de banco de dados detalhada e esqueleto do motor de execução de fluxo.

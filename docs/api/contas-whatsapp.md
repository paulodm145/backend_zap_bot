# Contas WhatsApp do tenant

## Objetivo e permissão

Esta funcionalidade implementa o pareamento de números via **Evolution API**
(servidor próprio, self-hosted, protocolo não oficial via Baileys) — decisão
registrada em `docs/ARQUITETURA-BACKEND.md` (seção 1.2) para a fase de estudo
deste projeto. Somente `ADMIN_TENANT` acessa as rotas.

Não há mais onboarding por token colado manualmente. O fluxo é **pareamento
por QR code**: o backend cria uma instância na Evolution API, recebe uma
credencial (`apikey`) gerada por ela, e o frontend exibe o QR code para o
usuário escanear com o WhatsApp do celular. Cada conta e sua `apikey`
(criptografada) ficam no banco físico do tenant; o banco central guarda
apenas o vínculo técnico `instance_name -> tenant` usado para resolver o
webhook — nunca a credencial em si.

Os planos permitem: Free uma conta, Starter uma conta e Pro três contas. O
backend valida o limite; o frontend deve tratar `422 VALIDACAO` ao cadastrar ou
reativar acima do plano.

> **Risco herdado da decisão de arquitetura:** por não ser um canal oficial,
> o número pareado está sujeito aos termos de uso do WhatsApp para automação
> não aprovada — oriente o usuário sobre boas práticas (volume moderado,
> opt-in) e não prometa SLA de entrega equivalente ao de uma Cloud API
> oficial.

## Telas e jornadas suportadas

1. **Cadastrar número** — formulário mínimo (só o nome de exibição interno) →
   modal com QR code → usuário escaneia com o app do WhatsApp → status muda
   de `CONECTANDO` para `CONECTADO` de forma assíncrona.
2. **Lista de números** — mostra todas as contas do tenant com status atual.
3. **Reconectar** — quando uma conta cai (`DESCONECTADO`) ou o QR expira antes
   de ser escaneado, gera um novo QR sem recriar a conta.
4. **Desconectar** — encerra a sessão pareada deliberadamente, mantendo o
   registro da conta (não é exclusão).

## Fluxo recomendado

1. `POST /api/v1/contas-whatsapp` com o nome — a resposta já traz o QR code
   inicial em base64 (`qrCodeBase64`). Exiba-o imediatamente; não é preciso
   chamar outro endpoint para o primeiro pareamento.
2. Enquanto o usuário não escaneia, o frontend não tem como saber o momento
   exato da conexão por resposta HTTP — faça polling de
   `GET /api/v1/contas-whatsapp/{contaId}` (ex.: a cada 3-5s) até
   `status` mudar para `CONECTADO`, ou trate a atualização quando o usuário
   revisitar a lista. Não há evento WebSocket dedicado nesta primeira versão
   (ver "Atualização de dados").
3. Se o QR expirar (Evolution normalmente expira em torno de 60s) sem
   pareamento, chame `POST /api/v1/contas-whatsapp/{contaId}/reconectar` para
   obter um novo `qrCodeBase64` e reiniciar a espera.
4. Para desconectar deliberadamente, chame
   `POST /api/v1/contas-whatsapp/{contaId}/desconectar` — a conta permanece
   cadastrada com `status: DESCONECTADO` e pode ser reconectada depois.

## Endpoints

| Método | Rota                                            | Finalidade                         |
| ------ | ----------------------------------------------- | ---------------------------------- |
| GET    | `/api/v1/contas-whatsapp`                       | Listagem paginada                  |
| POST   | `/api/v1/contas-whatsapp`                       | Criar instância e devolver o 1º QR |
| GET    | `/api/v1/contas-whatsapp/{contaId}`             | Abrir detalhe / consultar status   |
| PUT    | `/api/v1/contas-whatsapp/{contaId}`             | Renomear a conta                   |
| PATCH  | `/api/v1/contas-whatsapp/{contaId}/status`      | Ativar ou desativar                |
| POST   | `/api/v1/contas-whatsapp/{contaId}/reconectar`  | Gerar novo QR code                 |
| POST   | `/api/v1/contas-whatsapp/{contaId}/desconectar` | Encerrar sessão pareada            |

## Composição das telas

**Formulário de criação** — um único campo:

```json
{ "nome": "Número principal" }
```

**Resposta da criação** (`201`) — guarde `qrCodeBase64` só em memória/estado de
tela; não é necessário persisti-lo, ele expira:

```json
{
  "conta": {
    "public_id": "26f25b4e-8fcb-4875-8cd2-022d2069d7c9",
    "nome": "Número principal",
    "instance_name": "tenant-1-ad7bbf98-7353-490b-a7ca-78ee3b608c93",
    "instance_id": "03f44d8e-5d8d-482d-ad20-02a9a52c2a47",
    "numero_exibicao": null,
    "status": "CONECTANDO",
    "ultima_sincronizacao_at": null,
    "ultimo_erro_codigo": null,
    "ultimo_erro_mensagem": null,
    "ativo": true,
    "created_at": "2026-09-13T17:37:10.175Z",
    "updated_at": "2026-09-13T17:37:10.175Z"
  },
  "qrCodeBase64": "data:image/png;base64,iVBORw0KG..."
}
```

Renderize `qrCodeBase64` diretamente em uma tag `<img src="...">` — já vem
como data URI completa. `instance_name` e `instance_id` são identificadores
técnicos; não os exiba como informação relevante ao usuário final.

**Listagem** — usa `skip`, `take` e `busca` (nome ou número de exibição).
Mostre nome, `numero_exibicao` (só populado após conexão bem-sucedida),
`status` e `ativo`.

**Reconectar/Desconectar** — não têm corpo de requisição. A resposta de
`reconectar` é `{ conta, qrCodeBase64? }` (o campo pode faltar se a instância
já estiver conectada); a de `desconectar` é a conta com `status: DESCONECTADO`.

## Estados da interface

- **Carregando**: enquanto aguarda a criação da instância (pode levar alguns
  segundos, já que a chamada cria recursos na Evolution API).
- **QR pendente**: `status === 'CONECTANDO'` — mostre o QR e um texto de
  espera; ofereça o botão "gerar novo código" mesmo antes de expirar.
- **Conectado**: `status === 'CONECTADO'` — mostre `numero_exibicao` quando
  disponível.
- **Desconectado**: `status === 'DESCONECTADO'` — destaque a ação
  "reconectar" com prioridade.
- **Vazio**: nenhuma conta cadastrada — chame para ação de criar a primeira.
- **Erro**: `ultimo_erro_codigo`/`ultimo_erro_mensagem` preenchidos — exiba a
  mensagem sanitizada; nunca a resposta bruta da Evolution API.

## Erros

- `404 NAO_ENCONTRADO` — conta inexistente ou de outro tenant.
- `409 CONFLITO` — colisão interna de nome de instância (extremamente raro,
  o nome é gerado pelo backend); trate como erro genérico e permita nova
  tentativa.
- `422 VALIDACAO` — limite de contas do plano atingido, ou a criação da
  instância na Evolution API falhou (servidor indisponível, por exemplo).

## Atualização de dados

Não há evento WebSocket dedicado à transição de status de conexão nesta
primeira versão — use polling do detalhe enquanto uma conta estiver
`CONECTANDO`. A atualização real do `status` acontece de forma assíncrona,
via webhook (`docs/eventos/webhook-whatsapp.md`), quando a Evolution API
notifica a mudança de estado da conexão (`connection.update`).

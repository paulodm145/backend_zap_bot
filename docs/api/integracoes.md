# Credenciais de integração

## Objetivo e perfis autorizados

Cadastro das APIs externas (ERP, CRM, sistema próprio do cliente) que os
fluxos deste tenant podem consultar. Cada credencial guarda o endereço base
autorizado e o segredo de autenticação.

Todas as rotas exigem `Authorization: Bearer <accessToken>` e papel
`ADMIN_TENANT` ou `GESTOR`. Atendente recebe `403 ACESSO_NEGADO` em qualquer
operação, inclusive na listagem: mesmo sem expor segredo, a lista revela quais
destinos externos a plataforma alcança.

## Regra central de segurança

O segredo entra, mas nunca volta. A configuração de autenticação é
criptografada em repouso com chave dedicada
(`INTEGRACOES_CREDENCIAIS_CRIPTOGRAFIA_CHAVE`) e **nenhuma resposta da API
devolve o token, a senha ou o campo `configuracao_encrypted`**. A tela de
edição, portanto, nunca consegue pré-preencher o segredo — ela mostra apenas
o tipo de autenticação e oferece o campo em branco para substituição.

A `baseUrl` funciona como allowlist por tenant: na etapa do bloco de fluxo, a
URL montada pelo nó precisa começar por ela. Por isso o cadastro recusa:

| Situação                               | Mensagem                                                 |
| -------------------------------------- | -------------------------------------------------------- |
| URL malformada                         | `Informe uma URL absoluta válida`                        |
| Protocolo diferente de HTTPS           | `A URL deve usar HTTPS`                                  |
| Usuário/senha embutidos na URL         | `A URL não pode conter usuário ou senha`                 |
| Host local, rede privada ou link-local | `A URL não pode apontar para host local ou rede privada` |

A última regra cobre `localhost`, `127.0.0.0/8`, `10.0.0.0/8`,
`172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` (metadata das nuvens),
IPv6 loopback/privado e sufixos internos como `.local` e `.internal`.

## Telas e jornada

A tela de integrações é uma listagem com busca, um formulário de cadastro e
um formulário de edição. A sequência recomendada:

1. `GET /api/v1/integracoes` para montar a lista.
2. `POST /api/v1/integracoes` ao cadastrar.
3. `GET /api/v1/integracoes/{integracaoId}` ao abrir a edição.
4. `PUT /api/v1/integracoes/{integracaoId}` ao salvar.
5. `DELETE /api/v1/integracoes/{integracaoId}` ao desativar.

## Endpoints

| Método   | Rota                                 | Finalidade                        |
| -------- | ------------------------------------ | --------------------------------- |
| `GET`    | `/api/v1/integracoes`                | Lista paginada com busca por nome |
| `POST`   | `/api/v1/integracoes`                | Cadastra credencial               |
| `GET`    | `/api/v1/integracoes/{integracaoId}` | Detalha credencial                |
| `PUT`    | `/api/v1/integracoes/{integracaoId}` | Atualiza campos informados        |
| `DELETE` | `/api/v1/integracoes/{integracaoId}` | Desativa logicamente              |

### Listagem

`GET /api/v1/integracoes?busca=erp&ativo=true&skip=0&take=20`

`busca` casa com o nome normalizado (sem acento, sem diferença de caixa).
`ativo` aceita `true`/`false`; omitido, traz ativas e inativas. `take` respeita
o limite máximo de paginação da plataforma.

```json
{
  "dados": [
    {
      "public_id": "9f0e1d2c-3b4a-5968-8776-a1b2c3d4e5f6",
      "nome": "ERP Contábil",
      "tipo_auth": "BEARER",
      "base_url": "https://api.erp-exemplo.com/v1",
      "ativo": true,
      "created_at": "2026-09-17T10:00:00.000Z",
      "updated_at": "2026-09-17T10:00:00.000Z"
    }
  ],
  "total": 1,
  "skip": 0,
  "take": 20
}
```

### Cadastro

`POST /api/v1/integracoes`

```json
{
  "nome": "ERP Contábil",
  "baseUrl": "https://api.erp-exemplo.com/v1",
  "autenticacao": { "tipo": "BEARER", "token": "token-do-cliente" }
}
```

Resposta `201` com o mesmo formato do item da listagem.

### Tipos de autenticação

O campo `autenticacao` é uma união discriminada por `tipo`. Enviar campo que
não pertence ao tipo escolhido resulta em `422`.

| `tipo`           | Campos obrigatórios  | Efeito na chamada externa        |
| ---------------- | -------------------- | -------------------------------- |
| `NENHUMA`        | —                    | Nenhum cabeçalho de autenticação |
| `BEARER`         | `token`              | `Authorization: Bearer <token>`  |
| `API_KEY_HEADER` | `cabecalho`, `valor` | `<cabecalho>: <valor>`           |
| `BASIC`          | `usuario`, `senha`   | `Authorization: Basic <base64>`  |

`cabecalho` aceita apenas letras, números e hífen, com até 64 caracteres.
`token`, `valor` e `senha` aceitam até 2048 caracteres.

### Atualização

`PUT /api/v1/integracoes/{integracaoId}` aceita `nome`, `baseUrl` e
`autenticacao`, todos opcionais, exigindo ao menos um.

- **Omitir `autenticacao` preserva o segredo já armazenado.** É o caminho para
  renomear ou trocar a URL sem pedir o token de novo ao usuário.
- **Enviar `autenticacao` substitui o segredo inteiro**, inclusive o tipo.

### Desativação

`DELETE /api/v1/integracoes/{integracaoId}` responde `204` e marca
`ativo: false`. O registro permanece para auditoria; não há exclusão física.
Chamar sobre credencial já inativa responde `404`.

## Estados de tela

| Estado            | Quando ocorre          | Sugestão                                     |
| ----------------- | ---------------------- | -------------------------------------------- |
| Carregando        | Durante a listagem     | Esqueleto de tabela                          |
| Vazio             | `total: 0` sem busca   | Convite para cadastrar a primeira integração |
| Vazio por busca   | `total: 0` com `busca` | Oferecer limpar a busca                      |
| Erro de validação | `422`                  | Destacar o campo usando `detalhes`           |
| Conflito          | `409`                  | Apontar o campo nome                         |
| Acesso negado     | `403`                  | Esconder a seção para atendente              |

## Erros

| Status | Código           | Situação                                |
| ------ | ---------------- | --------------------------------------- |
| `403`  | `ACESSO_NEGADO`  | Usuário sem papel de gestão             |
| `404`  | `NAO_ENCONTRADO` | Credencial inexistente ou já desativada |
| `409`  | `CONFLITO`       | Já existe credencial com o mesmo nome   |
| `422`  | `VALIDACAO`      | URL recusada ou autenticação incompleta |

## Tempo real

Não há evento WebSocket para esta funcionalidade. Após cada mutação, refaça a
listagem.

## Relação com o fluxo

Estas credenciais são consumidas pelo bloco `integracao_http` do editor de
fluxos, entregue na etapa seguinte
(`docs/TAREFAS-INTEGRACAO-HTTP-FLUXO.md`). Enquanto o bloco não existir, o
cadastro é útil apenas para preparar os destinos autorizados.

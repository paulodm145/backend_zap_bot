# Cliente HTTP do frontend

## Configuração

Use uma única URL base configurável. Em desenvolvimento:

```ts
const API_URL = 'http://localhost:3000/api/v1';
```

Não derive tenant por hostname ou subdomínio. O login resolve o banco físico
pelo e-mail e as demais requisições usam o `tenantId` assinado no JWT.

## Chamada JSON

O frontend deve enviar cookies, interpretar respostas sem corpo e preservar o
erro padronizado:

```ts
interface ErroApi {
  erro: {
    codigo: string;
    mensagem: string;
    detalhes?: unknown;
  };
}

async function chamarApi<T>(
  caminho: string,
  opcoes: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...opcoes.headers,
    },
  });

  if (!resposta.ok) {
    throw (await resposta.json()) as ErroApi;
  }

  if (resposta.status === 204) return undefined as T;
  return (await resposta.json()) as T;
}
```

Os tipos reais devem ser gerados ou escritos a partir de
`GET /api/v1/openapi.json`. O exemplo usa `unknown` nos detalhes porque cada
código de erro pode possuir uma estrutura específica; valide antes de acessar.

Para gerar os tipos da INT-10 com a API em execução:

```bash
npx openapi-typescript \
  http://localhost:3000/api/v1/openapi.json \
  --output src/lib/api/generated.ts
```

O endereço deve ser obtido pela origem exata configurada em
`ORIGENS_PERMITIDAS`. Respostas JSON 2xx possuem schema executável no contrato;
respostas `204` não possuem corpo e não devem ser desserializadas.

## Login e renovação tenant

Fluxo recomendado:

1. Chamar `POST /auth/login` com e-mail e senha.
2. Guardar apenas o `accessToken` no estado de sessão.
3. Enviar Bearer nas rotas tenant.
4. Ao receber o primeiro `401`, chamar `POST /auth/refresh` sem body.
5. Atualizar o access token e repetir a chamada original uma vez.
6. Se o refresh retornar `401`, limpar a sessão e abrir o login.

Use uma promessa compartilhada ou mutex durante o refresh. Sem isso, várias
requisições simultâneas podem tentar rotacionar o mesmo cookie; a reutilização
de um refresh token antigo revoga a família da sessão por segurança.

Não aplique esse interceptor a `/auth/login`, `/auth/refresh` ou às rotas
`/interno`. A autenticação interna não possui refresh token.

## Sessão interna

Mantenha o JWT interno separado do JWT tenant. Após
`POST /interno/auth/login`:

- se `exigeSegundoFator=false`, use o `accessToken` retornado;
- se `exigeSegundoFator=true`, mantenha `estadoToken` apenas durante a jornada
  de TOTP;
- após `/interno/auth/2fa/verificar`, descarte `estadoToken` e guarde o JWT
  interno;
- em qualquer `401` de `/interno`, encerre a sessão administrativa.

## Paginação e busca

Listagens usam `skip`/`take`. Calcule `skip = pagina * take` e mantenha filtros
na URL da tela. `busca` é opcional e não deve ser enviado vazio. Cancele a
requisição anterior com `AbortController` quando o usuário continuar digitando.

```ts
const consulta = new URLSearchParams({
  skip: String(pagina * take),
  take: String(take),
  ...(busca.trim() ? { busca: busca.trim() } : {}),
});
```

## Cache e mutações

- criação: invalidar lista e navegar para o identificador público retornado;
- atualização: invalidar lista e detalhe;
- exclusão `204`: remover do cache sem tentar ler JSON;
- publicação de fluxo: invalidar detalhe e listas de rascunhos/publicados;
- alteração de tenant: invalidar lista e detalhe administrativo;
- `404`: remover referência local obsoleta;
- `409`: buscar o estado atual antes de oferecer novo retry;
- `422`: manter dados digitados e mapear `detalhes` para campos ou nós.

## Cookies e CORS

O backend usa `credentials: true` e uma origem exata configurada em
`ORIGENS_PERMITIDAS`. O frontend não funcionará com uma origem diferente da
configurada. O refresh token é `HttpOnly`, `Secure`, `SameSite=None` e não pode
ser lido por JavaScript. Em ambientes separados, frontend e API devem usar
HTTPS para que o navegador aceite o cookie seguro.

## Diagnóstico

Registre no monitoramento do frontend:

- método e caminho, sem query sensível;
- status HTTP;
- `erro.codigo`;
- `X-Correlation-Id` devolvido pelo backend.

Nunca registre senha, access token, cookie, segredo TOTP, string de conexão ou
corpo completo do webhook.

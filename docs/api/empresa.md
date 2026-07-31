# Cadastro da empresa

## Objetivo e permissões

O perfil empresarial pertence exclusivamente ao banco físico do tenant. Todo
usuário autenticado pode consultá-lo; somente `ADMIN_TENANT` pode salvar. O
cadastro é gradual e nenhum campo precisa ser preenchido na contratação.

## Tela recomendada

Ao abrir “Dados da empresa”, faça `GET /api/v1/empresa`. Uma resposta `null`
representa cadastro ainda não iniciado e deve abrir o formulário vazio. A API
retorna os nomes persistidos em `snake_case`; o formulário de escrita usa
`camelCase`, conforme o Swagger.

Organize a tela em identificação, contato e endereço. Campos sugeridos:
razão social, nome fantasia, CNPJ, e-mail, telefone, site, CEP, logradouro,
número, complemento, bairro, município e UF. Para usuários sem permissão de
admin, apresente a mesma tela em modo somente leitura.

## Endpoints

| Método | Rota                                  | Acesso         | Finalidade                |
| ------ | ------------------------------------- | -------------- | ------------------------- |
| GET    | `/api/v1/empresa`                     | JWT tenant     | Carregar o perfil         |
| PUT    | `/api/v1/empresa`                     | `ADMIN_TENANT` | Salvar campos informados  |
| GET    | `/api/v1/empresa/consultar-cep/{cep}` | JWT tenant     | Sugerir endereço pelo CEP |

## Salvamento gradual

O `PUT` é parcial: envie apenas os campos alterados. Use `null` para limpar um
campo opcional. CNPJ e CEP podem ser digitados com máscara; o backend valida e
persiste somente dígitos. Exemplo:

```json
{
  "nomeFantasia": "Empresa Exemplo",
  "cnpj": "11.222.333/0001-81",
  "email": "contato@empresa.com",
  "telefone": "+55 (11) 99999-9999"
}
```

## Preenchimento por CEP

Após o usuário informar oito dígitos, consulte o endpoint de CEP. O retorno é
apenas sugestão e não altera o banco. Preencha somente campos ainda vazios ou
peça confirmação antes de substituir algo que o usuário editou. O endereço só
é persistido no `PUT` posterior.

```json
{
  "cep": "01001000",
  "uf": "SP",
  "municipio": "São Paulo",
  "bairro": "Sé",
  "logradouro": "Praça da Sé",
  "municipioCodigoIbge": "3550308"
}
```

## Estados e erros da interface

- `401`: renove a sessão uma vez pelo fluxo padrão de refresh.
- `403`: remova a ação de salvar e informe falta de permissão.
- `422`: associe `erro.detalhes` aos campos quando disponível.
- Falha na consulta do CEP: preserve os valores digitados e permita entrada
  manual; não bloqueie o salvamento da empresa.

Após salvar com sucesso, substitua o estado local pela resposta do `PUT`. Não
envie `tenantId`: a conexão é resolvida exclusivamente pela identidade do JWT.

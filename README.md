# Tasks API

API REST de tarefas por usuário, construída com Node.js, TypeScript, Express 5, Drizzle ORM e PostgreSQL, com autenticação JWT, validação com zod, documentação OpenAPI e testes que rodam em qualquer máquina sem Docker.

[![CI](https://github.com/anwarquirino/tasks-api/actions/workflows/ci.yml/badge.svg)](https://github.com/anwarquirino/tasks-api/actions/workflows/ci.yml)
[![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue.svg)](LICENSE)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](package.json)

## Funcionalidades

- Registro e login com senha protegida por bcrypt e access token JWT (HS256).
- CRUD completo de tarefas com `title`, `description`, `status` (`pending`, `in_progress`, `done`), `priority` (`low`, `medium`, `high`) e `dueDate`.
- Listagem com filtros por status e prioridade, paginação (`page`, `limit`) com metadados e ordenação por qualquer campo relevante.
- Isolamento total entre usuários: uma tarefa de outra pessoa responde `404`, nunca vaza.
- Validação de corpo, query e parâmetros com zod; erros `400` listam cada campo com problema, em português.
- Respostas de erro consistentes em toda a API: `{ "error": { "code", "message", "details?" } }`.
- Segurança básica: `helmet`, CORS configurável e rate limit por IP nas rotas de login e registro.
- Logs estruturados com pino e pino-http, com o cabeçalho `Authorization` redigido.
- `GET /health` verifica a conexão com o banco.
- Documentação OpenAPI 3 escrita à mão, servida com Swagger UI em `/docs`.
- Migrations SQL versionadas, geradas pelo drizzle-kit e aplicadas pelo migrator do Drizzle.
- Dockerfile multi-stage, Docker Compose com PostgreSQL 16 e pipeline de CI no GitHub Actions.

## Stack

| Tecnologia                                       | Por que                                                                                                                                                         |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js 20+ e TypeScript strict em ESM           | Tipagem rígida pega erros antes de rodar; ESM é o padrão atual do ecossistema.                                                                                  |
| Express 5                                        | Minimalista e amplamente conhecido; a versão 5 encaminha erros de handlers `async` ao handler de erros sem bibliotecas extras.                                  |
| Drizzle ORM + drizzle-kit                        | Consultas tipadas que ficam próximas do SQL real, schema como fonte da verdade e migrations SQL legíveis e versionadas.                                         |
| PostgreSQL (`pg`) em dev/prod, PGlite nos testes | PGlite é o PostgreSQL compilado para WASM: os testes rodam contra um Postgres de verdade, em memória, com as mesmas migrations, sem Docker nem serviço externo. |
| zod                                              | Um único schema valida e tipa a entrada; mensagens em pt-BR via locale oficial.                                                                                 |
| jose e bcryptjs                                  | JWT com biblioteca ESM moderna, sem dependências nativas; bcryptjs evita build nativo em qualquer sistema.                                                      |
| pino                                             | Logs JSON rápidos, com redação de campos sensíveis.                                                                                                             |
| Vitest + supertest                               | Testes rápidos e isolados, exercitando a aplicação Express de ponta a ponta via HTTP.                                                                           |

## Como rodar

Pré-requisitos: Node.js 20 ou superior e npm.

### Local, com um PostgreSQL próprio

```bash
git clone https://github.com/anwarquirino/tasks-api.git
cd tasks-api
npm install
cp .env.example .env
# edite DATABASE_URL e JWT_SECRET no .env
npm run db:migrate
npm run dev
```

A API sobe em `http://localhost:3000`. A documentação interativa fica em `http://localhost:3000/docs`.

### Com Docker Compose

```bash
cp .env.example .env
# defina um JWT_SECRET forte no .env
docker compose up --build
```

O Compose sobe um PostgreSQL 16, espera o banco ficar saudável, aplica as migrations e inicia a API na porta `3000`.

### Sem PostgreSQL, só para experimentar

Com `DB_DRIVER=pglite` a API roda sobre um PostgreSQL em memória. Os dados são perdidos ao encerrar o processo, por isso só serve para explorar a API ou rodar os testes.

```bash
DB_DRIVER=pglite JWT_SECRET=um-segredo-qualquer-com-32-caracteres-ou-mais npm run dev
```

### Scripts disponíveis

| Script                  | O que faz                                            |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | Sobe a API com recarga automática (`tsx watch`).     |
| `npm run build`         | Compila para `dist/`.                                |
| `npm start`             | Executa a versão compilada.                          |
| `npm test`              | Roda a suíte de testes uma vez.                      |
| `npm run test:watch`    | Roda os testes em modo observação.                   |
| `npm run test:coverage` | Roda os testes com relatório de cobertura.           |
| `npm run lint`          | ESLint com regras cientes de tipos.                  |
| `npm run typecheck`     | `tsc --noEmit` em código e testes.                   |
| `npm run format`        | Formata tudo com Prettier.                           |
| `npm run db:generate`   | Gera uma nova migration a partir do schema.          |
| `npm run db:migrate`    | Aplica as migrations pendentes no banco configurado. |

## Variáveis de ambiente

Todas são validadas na inicialização; se algo estiver errado o processo encerra com uma mensagem apontando a variável.

| Variável                    | Obrigatória           | Padrão        | Descrição                                                                        |
| --------------------------- | --------------------- | ------------- | -------------------------------------------------------------------------------- |
| `NODE_ENV`                  | não                   | `development` | `development`, `test` ou `production`. Em `development` os logs saem formatados. |
| `PORT`                      | não                   | `3000`        | Porta HTTP.                                                                      |
| `LOG_LEVEL`                 | não                   | `info`        | Nível do pino: `fatal`, `error`, `warn`, `info`, `debug`, `trace` ou `silent`.   |
| `DB_DRIVER`                 | não                   | `pg`          | `pg` usa o PostgreSQL de `DATABASE_URL`; `pglite` usa um banco em memória.       |
| `DATABASE_URL`              | quando `DB_DRIVER=pg` | -             | URL `postgres://usuario:senha@host:5432/banco`.                                  |
| `JWT_SECRET`                | sim                   | -             | Segredo do HS256, com no mínimo 32 caracteres.                                   |
| `JWT_EXPIRES_IN`            | não                   | `1h`          | Validade do token, no formato `15m`, `1h` ou `7d`.                               |
| `AUTH_RATE_LIMIT_WINDOW_MS` | não                   | `900000`      | Janela do rate limit de login/registro (15 min).                                 |
| `AUTH_RATE_LIMIT_MAX`       | não                   | `20`          | Requisições por IP permitidas na janela.                                         |
| `CORS_ORIGIN`               | não                   | `*`           | `*` ou lista de origens separadas por vírgula.                                   |

## Endpoints

| Método   | Rota             | Auth | Descrição                                         |
| -------- | ---------------- | ---- | ------------------------------------------------- |
| `GET`    | `/health`        | não  | Estado da API e do banco.                         |
| `GET`    | `/docs`          | não  | Swagger UI.                                       |
| `GET`    | `/openapi.yaml`  | não  | Especificação OpenAPI 3 em YAML.                  |
| `POST`   | `/auth/register` | não  | Cria uma conta e devolve o token.                 |
| `POST`   | `/auth/login`    | não  | Autentica e devolve o token.                      |
| `GET`    | `/auth/me`       | sim  | Perfil do usuário autenticado.                    |
| `GET`    | `/tasks`         | sim  | Lista tarefas com filtros, paginação e ordenação. |
| `POST`   | `/tasks`         | sim  | Cria uma tarefa.                                  |
| `GET`    | `/tasks/:id`     | sim  | Busca uma tarefa.                                 |
| `PATCH`  | `/tasks/:id`     | sim  | Atualiza parcialmente uma tarefa.                 |
| `DELETE` | `/tasks/:id`     | sim  | Remove uma tarefa.                                |

Parâmetros de `GET /tasks`: `status`, `priority`, `page` (padrão 1), `limit` (padrão 10, máximo 100), `sortBy` (`createdAt`, `updatedAt`, `dueDate`, `priority`, `title`; padrão `createdAt`) e `order` (`asc` ou `desc`; padrão `desc`).

### Exemplos

Registro:

```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana Souza","email":"ana@example.com","password":"senha-forte-123"}'
```

```json
{
  "user": {
    "id": "7d1a1b7e-0c2f-4b57-9b0f-3f2a0b2c9d11",
    "name": "Ana Souza",
    "email": "ana@example.com",
    "createdAt": "2026-10-10T12:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

Login:

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"senha-forte-123"}'
```

A resposta tem o mesmo formato do registro. Guarde o `token` para as próximas chamadas.

Criação de tarefa:

```bash
curl -s -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Estudar Drizzle ORM","priority":"high","dueDate":"2026-10-20T18:00:00-03:00"}'
```

```json
{
  "id": "2f9a0c4e-6b1d-4f3a-8e2b-1c0d9e8f7a65",
  "userId": "7d1a1b7e-0c2f-4b57-9b0f-3f2a0b2c9d11",
  "title": "Estudar Drizzle ORM",
  "description": null,
  "status": "pending",
  "priority": "high",
  "dueDate": "2026-10-20T21:00:00.000Z",
  "createdAt": "2026-10-10T12:05:00.000Z",
  "updatedAt": "2026-10-10T12:05:00.000Z"
}
```

Erro de validação (`400`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": [
      { "path": "title", "message": "O título é obrigatório" },
      { "path": "status", "message": "status deve ser um de: pending, in_progress, done" }
    ]
  }
}
```

## Testes

```bash
npm test
```

A suíte usa Vitest e supertest. Cada arquivo de teste sobe um PostgreSQL em memória com PGlite, aplica as migrations da pasta `drizzle/` e exercita a aplicação Express por HTTP. Não é preciso instalar nem configurar banco algum.

O que é coberto:

- registro (sucesso, e-mail duplicado, dados inválidos) e login (sucesso, senha errada, e-mail desconhecido);
- acesso sem token, com token inválido, assinado com outro segredo e expirado;
- rate limit nas rotas de autenticação;
- criação, consulta, atualização parcial e remoção de tarefas, incluindo os `400` de validação;
- isolamento entre usuários em todas as operações;
- paginação com metadados, filtros por status e prioridade e ordenação;
- health check, rota inexistente, JSON malformado e cabeçalhos de segurança;
- fidelidade do `openapi.yaml`: toda operação documentada existe e responde com um status previsto.

## Estrutura de pastas

```
.
├── .github/workflows/ci.yml   # lint, typecheck, test e build em push e PR
├── drizzle/                   # migrations SQL geradas pelo drizzle-kit (+ snapshots)
├── openapi.yaml               # especificação OpenAPI 3 escrita à mão
├── src/
│   ├── app.ts                 # monta o Express (sem listen), usado pelos testes
│   ├── server.ts              # ponto de entrada: env, banco, listen e shutdown
│   ├── config/
│   │   ├── env.ts             # validação das variáveis de ambiente com zod
│   │   └── zod-locale.ts      # mensagens padrão do zod em pt-BR
│   ├── db/
│   │   ├── schema.ts          # tabelas e enums do Drizzle
│   │   ├── index.ts           # createDb(): escolhe pg ou PGlite pelo ambiente
│   │   └── migrate.ts         # script de `npm run db:migrate`
│   ├── docs/openapi.ts        # carrega o openapi.yaml
│   ├── lib/                   # http-error, jwt, password, logger, db-errors
│   ├── middlewares/           # auth, validate, rate-limit, error-handler
│   ├── modules/
│   │   ├── auth/              # schemas, service, controller e rotas de autenticação
│   │   ├── tasks/             # schemas, service, controller e rotas de tarefas
│   │   ├── docs/              # Swagger UI e /openapi.yaml
│   │   └── health/            # GET /health
│   └── types/express.d.ts     # tipa req.user
├── tests/                     # helpers com PGlite e os *.test.ts
├── Dockerfile                 # build multi-stage
└── docker-compose.yml         # api + postgres 16
```

## Decisões e próximos passos

Decisões:

- **Camadas por módulo (schemas, service, controller, rotas)**, com dependências injetadas por funções `create*`. Nada é singleton global, então os testes montam quantas aplicações quiserem, cada uma com seu banco.
- **Um só tipo `Database`** (`PgDatabase<PgQueryResultHKT, Schema>`) atende node-postgres e PGlite. O PGlite é `devDependency` e é carregado com `import()` dinâmico, então a imagem de produção não o inclui.
- **404 em vez de 403** para tarefas de outros usuários: toda consulta já filtra por `userId`, o que evita confirmar que o recurso existe.
- **Login com tempo constante**: quando o e-mail não existe, a senha é comparada com um hash descartável, para que a resposta demore o mesmo que uma senha errada.
- **E-mail duplicado tratado pela constraint única** do banco (SQLSTATE `23505`) em vez de uma consulta prévia, o que elimina a condição de corrida entre dois registros simultâneos.
- **Validação no middleware** (`validate`), que substitui `req.body`, `req.query` e `req.params` pelos valores já normalizados; os controllers recebem dados tipados e com defaults aplicados.
- **Access token apenas**, sem refresh token, para manter o escopo enxuto; a validade é configurável.
- **`npm audit`** acusa uma versão antiga do `esbuild` usada internamente pelo `drizzle-kit` (ferramenta de desenvolvimento, não entra no build). Não há correção sem downgrade do drizzle-kit, então foi mantida.

Próximos passos:

- Refresh token com rotação e logout.
- Confirmação de e-mail e recuperação de senha.
- Busca textual em título e descrição e filtro por intervalo de `dueDate`.
- Métricas (Prometheus) e `trust proxy` configurável para rate limit atrás de balanceadores.
- Pipeline de deploy a partir da imagem Docker.

## Licença

[MIT](LICENSE) - Copyright (c) 2026 Anwar Quirino

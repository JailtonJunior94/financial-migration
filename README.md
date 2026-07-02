# financial-migration

CLI de migração financeira com Bun, TypeScript, arquitetura hexagonal e modelagem funcional inspirada em *Domain Modeling Made Functional*.

## Objetivo

- Conectar em dois SQL Server distintos.
- Introspectar o DDL relevante para migração.
- Selecionar uma entidade piloto de baixo acoplamento.
- Extrair, validar, mapear para domínio e publicar via `POST` em um novo serviço.
- Retomar com segurança por meio de checkpoints idempotentes.

## Comandos

```bash
bun run dev -- schema:inspect
bun run dev -- schema:select-pilot
bun run dev -- sync:pilot --dry-run
bun run dev -- sync:pilot
bun run dev -- checkpoint:list
bun run dev -- checkpoint:reset
```

## Estrutura

- `src/domain`: tipos de domínio, validações e workflows puros.
- `src/application`: portas e casos de uso.
- `src/adapters`: SQL Server, HTTP/OpenAPI, checkpoint e logging.
- `src/bootstrap`: CLI e composição.
- `openapi`: contrato OpenAPI de referência.
- `test`: unitários e integração opcional.

## Contrato OpenAPI

O projeto inclui um contrato de exemplo em `openapi/target-service.openapi.json`. Regere os tipos com:

```bash
bun run openapi:generate
```

## Operação

1. Copie `.env.example` para `.env`.
2. Ajuste conexões e URL/token da API.
3. Execute `make install`.
4. Rode `make inspect-schema` e `make select-pilot`.
5. Valide com `bun run dev -- sync:pilot --dry-run`.

## Testes

```bash
make test
make lint
make typecheck
```

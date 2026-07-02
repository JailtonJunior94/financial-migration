<!-- governance-schema: 1.0.0 -->
# AGENTS.md

Instrucoes persistentes para agentes trabalhando neste repositorio.

## Objetivo do projeto

Este repositorio implementa um CLI de migracao financeira com Bun e TypeScript.
O fluxo principal atual e:

1. inspecionar schema em SQL Server
2. selecionar uma entidade piloto
3. extrair e mapear registros para o dominio
4. publicar no servico alvo via HTTP
5. retomar execucoes com checkpoints idempotentes

## Stack e arquitetura

- Runtime: Bun
- Linguagem: TypeScript
- Estilo: ESM (`type: module`)
- Lint/format: Biome
- Testes: `bun test`
- Dominio e aplicacao seguem arquitetura hexagonal

Estrutura principal:

- `src/domain`: regras puras, tipos e validacoes
- `src/application`: portas e casos de uso
- `src/adapters`: SQL Server, HTTP, checkpoint e logging
- `src/bootstrap`: CLI, configuracao e composicao
- `src/generated`: tipos gerados de OpenAPI
- `test`: testes unitarios e integracao
- `openapi`: contrato de referencia

## Regras de arquitetura

- Mantenha dependencias apontando para dentro: `bootstrap` -> `adapters` -> `application` -> `domain`.
- `domain` nao deve importar Bun, drivers, HTTP, logger concreto ou IO.
- `application` define portas; `adapters` implementam essas portas.
- Mudancas de regra de negocio devem acontecer primeiro em `domain` ou `application`, nao em `bootstrap`.
- Evite mover logica de negocio para adapters ou utilitarios transversais.

## Regras de trabalho

- Entenda o fluxo atual antes de editar.
- Prefira a menor mudanca segura que resolva a causa raiz.
- Preserve nomes, fronteiras e padroes ja usados no repositorio.
- Nao introduza dependencias novas sem necessidade clara.
- Nao altere contrato publico da CLI ou comportamento de migracao sem deixar isso explicito.
- Quando houver mudanca de comportamento, atualize ou adicione testes.
- Se gerar codigo OpenAPI, trate `src/generated/target-api.ts` como artefato derivado.

## Comandos do projeto

Use os comandos reais do repositorio, preferindo `bun` e `make`.

Instalacao e execucao:

- `bun install`
- `bun run dev -- --help`
- `make inspect-schema`
- `make select-pilot`
- `make sync-pilot`

Qualidade:

- `bun run build`
- `bun run typecheck`
- `bun run lint`
- `bun run format`
- `bun run test`
- `bun run test:integration`

OpenAPI:

- `bun run openapi:generate`

Se o ambiente tiver `rtk`, prefira prefixar comandos de shell com `rtk`. Se nao tiver, execute o comando diretamente.

## Convencoes de implementacao

- Mantenha funcoes de dominio deterministicas e sem efeitos colaterais.
- Trate erros com tipos e resultados consistentes com o padrao ja existente no codigo.
- Preserve validacoes em torno de checkpoints, fingerprint e idempotencia.
- Em mudancas de CLI, ajuste composicao e wiring em `src/bootstrap` com o minimo de acoplamento novo.
- Em mudancas de integracao SQL Server ou HTTP, teste a borda no adapter e a regra no dominio/aplicacao separadamente.

## Uso do harness

- A fonte canonica das skills e `.agents/skills/`.
- Para mudancas de codigo, carregue `.agents/skills/agent-governance/SKILL.md`.
- Para mudancas em Node/TypeScript, carregue tambem `.agents/skills/node-implementation/SKILL.md`.
- Use skills de planejamento (`analyze-project`, `create-prd`, `create-technical-specification`, `create-tasks`) apenas quando a tarefa pedir esse fluxo explicitamente.
- Carregue referencias adicionais somente quando a tarefa realmente exigir.

## Validacao antes de concluir

Escolha validacoes proporcionais ao risco, mas use estes defaults:

- mudanca pequena de TypeScript: `bun run typecheck`
- mudanca de comportamento: `bun run test`
- mudanca estrutural relevante: `bun run lint` e `bun run test`
- mudanca em contrato OpenAPI: `bun run openapi:generate` e revisar diff do gerado

Se nao for possivel executar alguma validacao, declare isso explicitamente.

## Claude e Codex

- Codex le este arquivo diretamente.
- Claude deve usar `CLAUDE.md`, que importa este arquivo para evitar duplicacao.
- Instrucoes mais especificas de Claude devem ficar em `CLAUDE.md` ou `.claude/rules/`.

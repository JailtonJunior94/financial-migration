# Governanca de Regras

- Rule ID: R-GOV-001
- Severidade: hard
- Escopo: `.agents/skills/`, `.claude/rules/`, `.claude/skills/`, `AGENTS.md` e `CLAUDE.md`

## Objetivo

Definir precedencia, resolucao de conflitos e criterios minimos de evidencia para agentes trabalhando neste repositorio.

## Fonte de verdade

- Regras persistentes do projeto: `AGENTS.md`
- Regras especificas do Claude: `CLAUDE.md`
- Skills canonicas: `.agents/skills/`
- Rules do Claude: `.claude/rules/`
- Referencias de governanca: `.agents/skills/agent-governance/references/`
- Referencias de implementacao Node/TypeScript: `.agents/skills/node-implementation/references/`

## Precedencia

1. Instrucoes explicitas do usuario
2. `AGENTS.md`
3. `CLAUDE.md`
4. Esta regra transversal
5. Skill ativa e suas referencias carregadas
6. Convencoes gerais de linguagem ou framework

Se duas regras do mesmo nivel conflitarem:

- prevalece a regra mais especifica para o arquivo ou fluxo afetado
- se a especificidade empatar, prevalece a regra mais restritiva para seguranca, corretude e determinismo
- convencao local documentada no repositorio prevalece sobre guia externo generico

## Politica de evidencia

- Toda alteracao deve ser justificavel por regra explicita, comportamento existente ou necessidade tecnica demonstravel.
- Relatorios finais devem deixar claros: o que mudou, validacoes executadas e riscos residuais.
- Nao concluir uma mudanca como segura se existir lacuna critica conhecida sem declarar isso explicitamente.

## Seguranca operacional

- Nao executar acoes destrutivas de git, publicacoes remotas ou rotacao de segredo sem pedido explicito.
- Nao inventar configuracao, schema, credencial ou comportamento externo nao verificado.
- Se faltar input obrigatorio e nao houver inferencia segura, o agente deve parar e explicitar o bloqueio.

## Regras de implementacao

- Preservar a fronteira hexagonal do projeto: `bootstrap` -> `adapters` -> `application` -> `domain`.
- `domain` nao deve depender de IO, Bun runtime, SQL Server, HTTP ou logger concreto.
- Em TypeScript/Bun, preferir os comandos reais do projeto (`bun run ...`, `make ...`) em vez de equivalentes genericos.
- Arquivos gerados, como `src/generated/target-api.ts`, so devem ser alterados pelo fluxo apropriado.

## Proibido

- Aprovar mudanca sem evidencia minima.
- Declarar validacao nao executada como se tivesse sido executada.
- Introduzir regra de outro stack sem aderencia ao contexto deste repositorio.

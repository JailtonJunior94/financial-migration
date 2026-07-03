# Tarefa 8.0: Implementar artefatos operacionais, CLI e rastreabilidade final

<critical>Ler prd.md e techspec.md desta pasta — sua tarefa será invalidada se você pular</critical>

## Visão Geral

Implementar a camada operacional final do pipeline: review artifacts sanitizados, progress store separado, comandos CLI por estágio, saída auditável e matriz de rastreabilidade ponta a ponta entre origem, consolidação, classificação e destino.

<requirements>
- Separar checkpoint operacional de review artifacts e bindings.
- Expor comandos CLI coerentes com os estágios do pipeline.
- Tornar rastreabilidade e bloqueios consumíveis para revisão humana e reprocessamento.
</requirements>

## Subtarefas

- [ ] 8.1 Implementar stores atômicos para progresso operacional e review artifacts.
- [ ] 8.2 Adaptar a CLI para comandos explícitos por estágio e utilitários operacionais.
- [ ] 8.3 Implementar a matriz de rastreabilidade entre origem, consolidação, classificação e destino.
- [ ] 8.4 Fechar observabilidade e saídas auditáveis por batch e por issue.

## Detalhes de Implementação

Seguir `techspec.md` nas seções `Monitoramento e Observabilidade`, `Arquivos Relevantes`, `ADR-003` e `Mapeamento Requisito -> Decisão -> Teste`. Esta tarefa fecha a prontidão operacional e a auditabilidade de produção.

## Critérios de Sucesso

- Checkpoint, bindings e issues ficam separados e gravados de forma atômica.
- A CLI não exige runtime completo desnecessário para comandos operacionais locais.
- Existe uma matriz de rastreabilidade consumível para auditoria de bloqueios e publicações.

## Skills Necessárias

<!-- MANDATÓRIO: preenchido por `create-tasks` Etapa 4.1 via descoberta agnóstica em `.agents/skills/`.
     NÃO inclua aqui skills auto-carregadas em runtime: `agent-governance`, `execute-task`, `bugfix`,
     `review`, `refactor`, nem skills `*-implementation` (linguagem, inferida pelo diff).
     Use o conteúdo único `Nenhuma além das auto-carregadas (governance + linguagem).` se a tarefa
     não exigir skill processual extra. -->

Nenhuma além das auto-carregadas (governance + linguagem).

## Testes da Tarefa

- [ ] Testes unitários para stores, serialização e rastreabilidade
- [ ] Testes de integração para corrupção/recuperação de arquivos e comandos CLI operacionais

<critical>SEMPRE CRIAR E EXECUTAR TESTES DA TAREFA ANTES DE CONSIDERAR A TAREFA COMO `done`</critical>

## Arquivos Relevantes
- `src/bootstrap/cli.ts`
- `src/bootstrap/composition/create-runtime.ts`
- `src/adapters/checkpoint/*`
- `src/application/use-cases/*`
- `test/adapters/*`
- `test/application/*`
- `test/integration/*`

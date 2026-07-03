# Tarefa 1.0: Fundar domínio e portas do pipeline financeiro

<critical>Ler prd.md e techspec.md desta pasta — sua tarefa será invalidada se você pular</critical>

## Visão Geral

Criar a base do novo pipeline em quatro estágios (`discovery`, `consolidation`, `classification`, `publication`) substituindo o modelo piloto genérico atual por value objects, estados e portas explícitas para o domínio financeiro.

<requirements>
- Implementar os tipos centrais definidos em `techspec.md` para domínio consolidado, publicação e bloqueio.
- Introduzir erros tipados, chaves de negócio e contratos de progresso/revisão sem vazar IO para o domínio.
- Preservar a arquitetura hexagonal e o strict TypeScript do repositório.
</requirements>

## Subtarefas

- [ ] 1.1 Criar módulos de domínio `discovery`, `consolidation`, `classification` e `publication`.
- [ ] 1.2 Implementar `MoneyAmount`, `OccurrenceDate`, `CanonicalFactKey`, `InstallmentPlan` e estados de bloqueio.
- [ ] 1.3 Definir portas de aplicação para discovery, categorias, cartões, transações, bindings, progresso e review artifacts.
- [ ] 1.4 Adaptar erros de domínio/aplicação para suportar causas operacionais mais específicas.

## Detalhes de Implementação

Seguir `techspec.md` nas seções `Arquitetura do Sistema`, `Interfaces Chave`, `Modelos de Dados` e `Conformidade com Padrões`. Esta tarefa não deve implementar queries, HTTP real nem CLI final; ela deve apenas estabelecer o esqueleto tipado e testável do pipeline.

## Critérios de Sucesso

- O código deixa de depender conceitualmente apenas de `PilotAggregate` e `SourceRecord` para o fluxo futuro.
- Os novos value objects validam invariantes críticas de data, dinheiro, parcelamento e chave canônica.
- As novas portas permitem implementar estágios posteriores sem acoplamento a adapters concretos.

## Skills Necessárias

<!-- MANDATÓRIO: preenchido por `create-tasks` Etapa 4.1 via descoberta agnóstica em `.agents/skills/`.
     NÃO inclua aqui skills auto-carregadas em runtime: `agent-governance`, `execute-task`, `bugfix`,
     `review`, `refactor`, nem skills `*-implementation` (linguagem, inferida pelo diff).
     Use o conteúdo único `Nenhuma além das auto-carregadas (governance + linguagem).` se a tarefa
     não exigir skill processual extra. -->

Nenhuma além das auto-carregadas (governance + linguagem).

## Testes da Tarefa

- [ ] Testes unitários para `MoneyAmount`, `OccurrenceDate`, `CanonicalFactKey` e `InstallmentPlan`
- [ ] Testes de integração não aplicáveis além da compilação dos contratos

<critical>SEMPRE CRIAR E EXECUTAR TESTES DA TAREFA ANTES DE CONSIDERAR A TAREFA COMO `done`</critical>

## Arquivos Relevantes
- `src/domain/common/*`
- `src/domain/discovery/*`
- `src/domain/consolidation/*`
- `src/domain/classification/*`
- `src/domain/publication/*`
- `src/application/ports/*`


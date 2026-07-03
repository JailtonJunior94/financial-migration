# Tarefa 3.0: Implementar elegibilidade do usuário e isolamento de tenant

<critical>Ler prd.md e techspec.md desta pasta — sua tarefa será invalidada se você pular</critical>

## Visão Geral

Implementar a resolução do universo legado de `Jailton`, incluindo segundo sinal forte, exceção afirmativa de `Accounts`, bloqueio de inelegíveis e rastreabilidade de evidências por fato e por usuário.

<requirements>
- Tratar nome contendo `Jailton` apenas como gatilho inicial.
- Exigir segundo sinal forte quando aplicável e bloquear conflitos de elegibilidade.
- Manter todos os registros de `AccountControlDB.Accounts` elegíveis por regra afirmativa explícita.
</requirements>

## Subtarefas

- [ ] 3.1 Modelar evidências, força de sinal e estado de elegibilidade.
- [ ] 3.2 Implementar matching do universo legado ao usuário destino.
- [ ] 3.3 Implementar exceção afirmativa de `Accounts`.
- [ ] 3.4 Bloquear fatos e usuários com vínculo insuficiente ou conflitante.

## Detalhes de Implementação

Seguir `techspec.md` nas seções `Modelos de Dados`, `Pontos de Integração` e `Abordagem de Testes`. A solução deve falhar fechada e preservar isolamento de tenant em todo o pipeline.

## Critérios de Sucesso

- Nenhum fato segue para consolidação sem elegibilidade ou exceção afirmativa explícita.
- As evidências usadas para cada decisão ficam auditáveis.
- Conflitos entre sinais fortes produzem bloqueio, não inferência silenciosa.

## Skills Necessárias

<!-- MANDATÓRIO: preenchido por `create-tasks` Etapa 4.1 via descoberta agnóstica em `.agents/skills/`.
     NÃO inclua aqui skills auto-carregadas em runtime: `agent-governance`, `execute-task`, `bugfix`,
     `review`, `refactor`, nem skills `*-implementation` (linguagem, inferida pelo diff).
     Use o conteúdo único `Nenhuma além das auto-carregadas (governance + linguagem).` se a tarefa
     não exigir skill processual extra. -->

Nenhuma além das auto-carregadas (governance + linguagem).

## Testes da Tarefa

- [ ] Testes unitários para matching, segundo sinal forte, exceção afirmativa e bloqueios
- [ ] Testes de integração mínimos para fluxo discovery -> elegibilidade usando snapshots controlados

<critical>SEMPRE CRIAR E EXECUTAR TESTES DA TAREFA ANTES DE CONSIDERAR A TAREFA COMO `done`</critical>

## Arquivos Relevantes
- `src/domain/consolidation/*`
- `src/application/use-cases/build-eligibility-scope.ts`
- `src/application/ports/*`
- `test/domain/*`
- `test/application/*`


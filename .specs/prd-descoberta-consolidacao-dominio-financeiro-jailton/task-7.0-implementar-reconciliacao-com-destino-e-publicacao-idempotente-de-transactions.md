# Tarefa 7.0: Implementar reconciliação com destino e publicação idempotente de transactions

<critical>Ler prd.md e techspec.md desta pasta — sua tarefa será invalidada se você pular</critical>

## Visão Geral

Implementar o estágio final de publicação de `transactions` com reconciliação `GET-before-POST`, comparação de payload canônico, bloqueio em divergência material e atualização consistente do progresso operacional.

<requirements>
- Consultar o destino antes de publicar.
- Pular fatos equivalentes já reconciliados e bloquear divergências materiais.
- Usar `Idempotency-Key` determinística e não depender apenas dela para deduplicação.
</requirements>

## Subtarefas

- [ ] 7.1 Implementar `TransactionBusinessKey` e o adapter HTTP de `transactions`.
- [ ] 7.2 Implementar comparação de payload canônico entre legado consolidado e remoto existente.
- [ ] 7.3 Implementar publicação idempotente com atualização de progresso.
- [ ] 7.4 Implementar política de retry limitada e tratamento de falhas transientes.

## Detalhes de Implementação

Seguir `techspec.md` nas seções `Endpoints de API`, `Pontos de Integração`, `Abordagem de Testes`, `ADR-002` e `ADR-003`. A tarefa deve garantir `at-least-once` com idempotência remota obrigatória e bloqueio em vez de mutação automática diante de divergência material.

## Critérios de Sucesso

- O sistema não republica fatos equivalentes já existentes no destino.
- Divergências materiais não viram `PATCH` automático; elas viram bloqueio auditável.
- Replay após falha entre `POST` e persistência local permanece seguro.

## Skills Necessárias

<!-- MANDATÓRIO: preenchido por `create-tasks` Etapa 4.1 via descoberta agnóstica em `.agents/skills/`.
     NÃO inclua aqui skills auto-carregadas em runtime: `agent-governance`, `execute-task`, `bugfix`,
     `review`, `refactor`, nem skills `*-implementation` (linguagem, inferida pelo diff).
     Use o conteúdo único `Nenhuma além das auto-carregadas (governance + linguagem).` se a tarefa
     não exigir skill processual extra. -->

Nenhuma além das auto-carregadas (governance + linguagem).

## Testes da Tarefa

- [ ] Testes unitários para equivalência, divergência e decisão `skip/publish/block`
- [ ] Testes de integração HTTP para `GET-before-POST`, duplicate, replay e falhas transientes

<critical>SEMPRE CRIAR E EXECUTAR TESTES DA TAREFA ANTES DE CONSIDERAR A TAREFA COMO `done`</critical>

## Arquivos Relevantes
- `src/domain/publication/*`
- `src/application/use-cases/publish-transactions.ts`
- `src/adapters/http/mecontrola-*`
- `src/adapters/checkpoint/*`
- `test/application/*`
- `test/integration/*`


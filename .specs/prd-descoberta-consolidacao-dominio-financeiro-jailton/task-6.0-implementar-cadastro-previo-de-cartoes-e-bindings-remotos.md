# Tarefa 6.0: Implementar cadastro prévio de cartões e bindings remotos

<critical>Ler prd.md e techspec.md desta pasta — sua tarefa será invalidada se você pular</critical>

## Visão Geral

Implementar o fluxo que reconhece cartões por chave de negócio, faz lookup no destino, cria apenas quando necessário e persiste o binding legado-remoto localmente para uso posterior na publicação de transações.

<requirements>
- Definir chave de negócio determinística do cartão.
- Fazer reconciliação antes de criar, evitando duplicidade.
- Persistir binding local seguro e reprocessável.
</requirements>

## Subtarefas

- [ ] 6.1 Implementar `CardBusinessKey` e normalização de identidade do cartão.
- [ ] 6.2 Implementar adapter HTTP de lookup e criação de `cards`.
- [ ] 6.3 Implementar `RemoteBindingStorePort` e persistência local dos bindings.
- [ ] 6.4 Implementar use case de cadastro prévio de cartões.

## Detalhes de Implementação

Seguir `techspec.md` nas seções `Interfaces Chave`, `Endpoints de API`, `Pontos de Integração` e `ADR-004`. A tarefa deve deixar os fatos ligados a cartão prontos para publicação em `transactions`.

## Critérios de Sucesso

- Cartões não são duplicados no destino quando já existir identidade equivalente.
- O binding legado-remoto fica persistido localmente e reutilizável em retries.
- O fluxo falha de forma auditável quando não conseguir reconciliar ou criar o cartão.

## Skills Necessárias

<!-- MANDATÓRIO: preenchido por `create-tasks` Etapa 4.1 via descoberta agnóstica em `.agents/skills/`.
     NÃO inclua aqui skills auto-carregadas em runtime: `agent-governance`, `execute-task`, `bugfix`,
     `review`, `refactor`, nem skills `*-implementation` (linguagem, inferida pelo diff).
     Use o conteúdo único `Nenhuma além das auto-carregadas (governance + linguagem).` se a tarefa
     não exigir skill processual extra. -->

Nenhuma além das auto-carregadas (governance + linguagem).

## Testes da Tarefa

- [ ] Testes unitários para chave de negócio e regras de binding
- [ ] Testes de integração HTTP para lookup/criação de `cards` e persistência local de binding

<critical>SEMPRE CRIAR E EXECUTAR TESTES DA TAREFA ANTES DE CONSIDERAR A TAREFA COMO `done`</critical>

## Arquivos Relevantes
- `src/domain/publication/*`
- `src/application/use-cases/publish-cards.ts`
- `src/adapters/http/mecontrola-*`
- `src/adapters/checkpoint/*`
- `test/application/*`
- `test/integration/*`


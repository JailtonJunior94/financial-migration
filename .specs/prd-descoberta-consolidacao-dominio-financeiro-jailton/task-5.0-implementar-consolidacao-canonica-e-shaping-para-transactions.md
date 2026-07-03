# Tarefa 5.0: Implementar consolidação canônica e shaping para transactions

<critical>Ler prd.md e techspec.md desta pasta — sua tarefa será invalidada se você pular</critical>

## Visão Geral

Implementar a consolidação cross-source que transforma fatos elegíveis e classificáveis em transações canônicas publicáveis, preservando granularidade correta, datas de ocorrência, half-even, forma de pagamento e parcelamento.

<requirements>
- Consolidar fatos equivalentes entre as duas bases por `CanonicalFactKey`.
- Publicar apenas `InvoiceItem` como fato detalhado de cartão e usar `Invoice` só para reconciliação/validação.
- Tratar `Bill`, `BillItem`, `Accounts`, `Transaction` e `TransactionItem` como fatos para `transactions` com diferenciação semântica adequada.
</requirements>

## Subtarefas

- [ ] 5.1 Implementar o algoritmo de reconciliação por tipo de fato.
- [ ] 5.2 Implementar shaping de `InvoiceItem` para transações de cartão.
- [ ] 5.3 Implementar shaping de `Accounts`, `Bill`, `BillItem`, `Transaction` e `TransactionItem` para transações não-cartão.
- [ ] 5.4 Implementar normalização monetária half-even, data canônica e parcelamento por parcela efetiva.

## Detalhes de Implementação

Seguir `techspec.md` nas seções `Modelos de Dados`, `Mapeamento por origem`, `Sequenciamento de Desenvolvimento` e `Mapeamento Requisito -> Decisão -> Teste`. Esta tarefa é o coração do domínio e deve produzir os fatos canônicos que serão consumidos por cadastro de cartão e publicação.

## Critérios de Sucesso

- Não há dupla contagem entre `Invoice` e `InvoiceItem`.
- O mesmo fato econômico cross-source gera a mesma chave canônica.
- Parcelas são publicadas como transações independentes com vínculo lógico estável.

## Skills Necessárias

<!-- MANDATÓRIO: preenchido por `create-tasks` Etapa 4.1 via descoberta agnóstica em `.agents/skills/`.
     NÃO inclua aqui skills auto-carregadas em runtime: `agent-governance`, `execute-task`, `bugfix`,
     `review`, `refactor`, nem skills `*-implementation` (linguagem, inferida pelo diff).
     Use o conteúdo único `Nenhuma além das auto-carregadas (governance + linguagem).` se a tarefa
     não exigir skill processual extra. -->

Nenhuma além das auto-carregadas (governance + linguagem).

## Testes da Tarefa

- [ ] Testes unitários para consolidação, conflito, shaping e parcelamento
- [ ] Testes de integração mínimos do fluxo elegibilidade + consolidação usando fixtures controladas

<critical>SEMPRE CRIAR E EXECUTAR TESTES DA TAREFA ANTES DE CONSIDERAR A TAREFA COMO `done`</critical>

## Arquivos Relevantes
- `src/domain/consolidation/*`
- `src/domain/publication/*`
- `src/application/use-cases/consolidate-financial-facts.ts`
- `test/domain/*`
- `test/application/*`


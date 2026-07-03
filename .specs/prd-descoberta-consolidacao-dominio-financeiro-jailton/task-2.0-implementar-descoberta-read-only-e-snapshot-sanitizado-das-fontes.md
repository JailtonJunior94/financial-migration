# Tarefa 2.0: Implementar descoberta read-only e snapshot sanitizado das fontes

<critical>Ler prd.md e techspec.md desta pasta — sua tarefa será invalidada se você pular</critical>

## Visão Geral

Construir o estágio de descoberta que lê somente as tabelas em escopo, coleta schema, índices, cardinalidade básica e amostras sanitizadas, sem qualquer escrita nas fontes legadas.

<requirements>
- Cobrir somente as tabelas listadas em `RF-01` e `RF-02`.
- Produzir snapshot sanitizado suficiente para documentar papel no domínio, granularidade e vínculos observáveis.
- Garantir que o fluxo permaneça estritamente read-only e que segredos não sejam persistidos em artefatos.
</requirements>

## Subtarefas

- [ ] 2.1 Restringir introspecção e leitura ao escopo do PRD.
- [ ] 2.2 Ler colunas, FKs, índices e cardinalidade básica.
- [ ] 2.3 Gerar amostras sanitizadas representativas por tabela.
- [ ] 2.4 Produzir a matriz por tabela fonte com papel, granularidade e riscos semânticos.

## Detalhes de Implementação

Seguir `techspec.md` nas seções `Visão Geral dos Componentes`, `Pontos de Integração`, `Abordagem de Testes` e `Mapeamento Requisito -> Decisão -> Teste`. Esta tarefa deve substituir a introspecção ampla atual por um snapshot de descoberta alinhado ao PRD.

## Critérios de Sucesso

- A descoberta lê apenas o escopo definido no PRD.
- O snapshot inclui schema, índices, cardinalidade e amostras sanitizadas.
- Não existe caminho de escrita nos SQL Servers dentro do estágio de discovery.

## Skills Necessárias

<!-- MANDATÓRIO: preenchido por `create-tasks` Etapa 4.1 via descoberta agnóstica em `.agents/skills/`.
     NÃO inclua aqui skills auto-carregadas em runtime: `agent-governance`, `execute-task`, `bugfix`,
     `review`, `refactor`, nem skills `*-implementation` (linguagem, inferida pelo diff).
     Use o conteúdo único `Nenhuma além das auto-carregadas (governance + linguagem).` se a tarefa
     não exigir skill processual extra. -->

Nenhuma além das auto-carregadas (governance + linguagem).

## Testes da Tarefa

- [ ] Testes unitários para sanitização e montagem do snapshot
- [ ] Testes de integração dos adapters SQL Server cobrindo scope, índices, cardinalidade e amostras

<critical>SEMPRE CRIAR E EXECUTAR TESTES DA TAREFA ANTES DE CONSIDERAR A TAREFA COMO `done`</critical>

## Arquivos Relevantes
- `src/adapters/sqlserver/*`
- `src/application/use-cases/discover-financial-domain.ts`
- `src/domain/discovery/*`
- `test/integration/*`


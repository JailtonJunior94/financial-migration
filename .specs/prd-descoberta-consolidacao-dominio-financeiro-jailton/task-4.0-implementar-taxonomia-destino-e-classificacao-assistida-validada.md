# Tarefa 4.0: Implementar taxonomia destino e classificação assistida-validada

<critical>Ler prd.md e techspec.md desta pasta — sua tarefa será invalidada se você pular</critical>

## Visão Geral

Implementar a integração de categorias e dicionário de categorias do destino, com classificação final validada contra a taxonomia real e uso restrito do OpenRouter apenas como apoio sem autonomia decisória.

<requirements>
- Consultar `categories` e `category-dictionary` como fonte de verdade.
- Cobrir `expense` e bloquear `income` quando a taxonomia não for suficiente.
- Diferenciar forma de pagamento não-cartão por matriz determinística, bloqueando quando a prova for insuficiente.
</requirements>

## Subtarefas

- [ ] 4.1 Implementar adapter de categorias e dicionário com headers de gateway.
- [ ] 4.2 Modelar categoria, subcategoria, método de pagamento e estados de classificação.
- [ ] 4.3 Implementar classificação validada por taxonomia.
- [ ] 4.4 Integrar apoio semântico opcional do OpenRouter sem decisão final automática.

## Detalhes de Implementação

Seguir `techspec.md` nas seções `Endpoints de API`, `Pontos de Integração`, `Abordagem de Testes` e `Decisões Chave`. Esta tarefa não publica fatos; ela apenas constrói a camada de classificação determinística.

## Critérios de Sucesso

- O sistema consegue resolver categoria/subcategoria válidas contra o destino.
- Receitas ficam bloqueadas quando a taxonomia `income` não for confirmada.
- Métodos como `pix` e `ted` não são inferidos sem evidência forte.

## Skills Necessárias

<!-- MANDATÓRIO: preenchido por `create-tasks` Etapa 4.1 via descoberta agnóstica em `.agents/skills/`.
     NÃO inclua aqui skills auto-carregadas em runtime: `agent-governance`, `execute-task`, `bugfix`,
     `review`, `refactor`, nem skills `*-implementation` (linguagem, inferida pelo diff).
     Use o conteúdo único `Nenhuma além das auto-carregadas (governance + linguagem).` se a tarefa
     não exigir skill processual extra. -->

Nenhuma além das auto-carregadas (governance + linguagem).

## Testes da Tarefa

- [ ] Testes unitários para classificação `expense`, `income`, fallback bloqueante e payment method
- [ ] Testes de integração HTTP para `categories` e `category-dictionary`

<critical>SEMPRE CRIAR E EXECUTAR TESTES DA TAREFA ANTES DE CONSIDERAR A TAREFA COMO `done`</critical>

## Arquivos Relevantes
- `src/domain/classification/*`
- `src/application/use-cases/classify-consolidated-transactions.ts`
- `src/adapters/http/mecontrola-*`
- `test/application/*`
- `test/integration/*`


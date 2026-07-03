# Registro de Decisão Arquitetural (ADR)

## Metadados

- **Título:** Pipeline em estágios com transactions como destino único
- **Data:** 2026-07-02
- **Status:** Aceita
- **Decisores:** solicitante, agente técnico
- **Relacionados:** `prd.md`, `techspec.md`

## Contexto

O PRD inicial admitia múltiplos recursos de destino, mas as clarificações posteriores fecharam que, na API nova, tudo que é fato financeiro publicável deve entrar como `transactions`, enquanto `cards` precisa existir antes como cadastro auxiliar. O código atual ainda opera em torno de um `PilotAggregate` genérico e um `POST /records`, o que não atende a semântica real do destino.

## Decisão

Adotar um pipeline explícito de `discovery -> consolidation -> classification -> publication`. O único recurso financeiro publicável será `transactions`. `cards` será publicado previamente apenas para suportar o vínculo estrutural de fatos originados de cartão e fatura.

## Alternativas Consideradas

- Manter múltiplos destinos (`card-purchases`, `card invoices`, `transactions`)
  - Vantagens: aderência ao desenho inicial do PRD.
  - Desvantagens: contradiz a regra final do solicitante e fragmenta a publicação.
  - Motivo de rejeição: conflito com a definição final do domínio alvo.
- Publicar tudo diretamente sem cadastro prévio de cartão
  - Vantagens: menos etapas.
  - Desvantagens: perde vínculo estruturado e dificulta reconciliação.
  - Motivo de rejeição: aumenta falso positivo e reduz auditabilidade.

## Consequências

### Benefícios Esperados

- Menor ambiguidade de destino.
- Modelo operacional mais simples para reconciliação.
- Menor risco de dupla contagem entre `Invoice` e `InvoiceItem`.

### Trade-offs e Custos

- Mais complexidade no mapeamento semântico para `transactions`.
- Necessidade de regras mais fortes de categoria, subcategoria e forma de pagamento.

### Riscos e Mitigações

- Risco: perda de semântica específica de cartão.
  Mitigação: manter `cards` como cadastro prévio e vínculo obrigatório para fatos de cartão.

## Plano de Implementação

1. Remover o contrato conceitual de `POST /records` do caminho principal.
2. Modelar fatos canônicos por tipo.
3. Implementar publicação prévia de cartões.
4. Implementar publicação única em `transactions`.

## Monitoramento e Validação

- Acompanhar proporção de fatos conciliados, publicados e bloqueados.
- Validar ausência de dupla contagem por competência de cartão.

## Impacto em Documentação e Operação

- Atualizar PRD e tech spec.
- Atualizar comandos CLI e runbooks operacionais.

## Revisão Futura

Revisitar caso a API destino passe a exigir ou expor novos recursos publicáveis além de `transactions`.


# Registro de Decisão Arquitetural (ADR)

## Metadados

- **Título:** Reconciliação por chave de negócio com GET-before-POST
- **Data:** 2026-07-02
- **Status:** Aceita
- **Decisores:** solicitante, agente técnico
- **Relacionados:** `prd.md`, `techspec.md`

## Contexto

O projeto atual usa fingerprint baseada em origem bruta e depende de checkpoint local após `POST`. Isso não fecha reconciliação cross-source nem protege adequadamente o replay em caso de falha entre publicação e persistência de progresso.

## Decisão

Toda publicação deve usar uma `CanonicalFactKey` por tipo de fato. Antes de cada `POST`, o sistema fará `GET` de reconciliação no destino. Se o fato já existir:

- payload equivalente: marca como reconciliado e não escreve;
- payload divergente: bloqueia para revisão manual;
- inexistente: publica com `Idempotency-Key` determinística.

## Alternativas Consideradas

- Confiar apenas em `Idempotency-Key`
  - Vantagens: implementação mais simples.
  - Desvantagens: deixa divergências silenciosas e depende demais do destino.
  - Motivo de rejeição: não atende objetivo de zero falso positivo.
- Atualizar automaticamente com `PATCH`
  - Vantagens: convergência automática.
  - Desvantagens: alto risco de sobrescrita indevida.
  - Motivo de rejeição: divergência material deve ser bloqueada, não normalizada.

## Consequências

### Benefícios Esperados

- Reconciliação auditável.
- Melhor resiliência a replay e retomada.
- Menor risco de duplicidade e de sobrescrita incorreta.

### Trade-offs e Custos

- Mais chamadas HTTP por fato.
- Necessidade de chave de negócio forte e estável.

### Riscos e Mitigações

- Risco: a API destino pode não expor filtros ideais.
  Mitigação: usar bindings locais e estratégias incrementais com leitura suportada.

## Plano de Implementação

1. Definir `CanonicalFactKey` por tipo.
2. Implementar lookup de destino por recurso.
3. Implementar comparação de payload canônico.
4. Persistir bindings e progresso.

## Monitoramento e Validação

- Medir `reconciled`, `published`, `blocked`, `duplicate`.
- Auditar divergências manuais por tipo de fato.

## Impacto em Documentação e Operação

- Atualizar documentação de idempotência e runbooks de replay.

## Revisão Futura

Revisitar se a API destino passar a suportar busca nativa por `externalId` ou recurso de upsert auditável.


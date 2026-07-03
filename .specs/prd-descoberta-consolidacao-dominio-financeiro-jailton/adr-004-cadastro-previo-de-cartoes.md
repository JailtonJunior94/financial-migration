# Registro de Decisão Arquitetural (ADR)

## Metadados

- **Título:** Cadastro prévio e binding determinístico de cartões
- **Data:** 2026-07-02
- **Status:** Aceita
- **Decisores:** solicitante, agente técnico
- **Relacionados:** `prd.md`, `techspec.md`

## Contexto

Fatos ligados a `invoice` devem virar `transactions` atreladas ao cartão. Para isso, o cartão precisa existir previamente no destino e não pode ser duplicado a cada execução.

## Decisão

Antes da publicação de qualquer transação ligada a cartão, o sistema deve:

1. construir uma chave de negócio determinística do cartão;
2. fazer lookup no destino;
3. criar com `POST` apenas se não existir;
4. persistir o binding `legacy card -> remote card id` localmente.

## Alternativas Consideradas

- Criar cartão sempre
  - Vantagens: simples.
  - Desvantagens: duplicidade no destino.
  - Motivo de rejeição: incompatível com uso em produção.
- Não cadastrar cartão e embutir tudo em `transactions`
  - Vantagens: menos etapas.
  - Desvantagens: perde vínculo estrutural e rastreabilidade.
  - Motivo de rejeição: reduz qualidade de reconciliação.

## Consequências

### Benefícios Esperados

- Vínculo estável entre transações de cartão e cartão remoto.
- Menor risco de duplicidade de cartões.

### Trade-offs e Custos

- Mais uma etapa obrigatória antes da publicação de transações.
- Necessidade de binding local persistente.

### Riscos e Mitigações

- Risco: lookup insuficiente no destino.
  Mitigação: binding local como fonte operacional complementar.

## Plano de Implementação

1. Definir `CardBusinessKey`.
2. Implementar lookup e create de cartão.
3. Persistir binding local.
4. Exigir binding antes de publicar transações de cartão.

## Monitoramento e Validação

- Medir cartões encontrados, criados e duplicados evitados.

## Impacto em Documentação e Operação

- Atualizar runbook de preparação de cartões.

## Revisão Futura

Revisitar se o destino passar a expor identificação canônica mais forte para cartões.

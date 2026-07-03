# Registro de Decisão Arquitetural (ADR)

## Metadados

- **Título:** Separação entre progresso operacional e artefatos de revisão manual
- **Data:** 2026-07-02
- **Status:** Aceita
- **Decisores:** solicitante, agente técnico
- **Relacionados:** `prd.md`, `techspec.md`

## Contexto

O projeto atual grava checkpoint único em arquivo JSON, misturando progresso, deduplicação e recuperação operacional. A nova funcionalidade precisa bloquear itens para revisão manual e manter auditabilidade sem corromper ou poluir o estado operacional.

## Decisão

Separar três persistências locais:

- `ProgressStore`: checkpoint operacional de leitura/publicação;
- `ReviewArtifactStore`: issues sanitizadas em NDJSON;
- `RemoteBindingStore`: vínculos entre identidades legadas e IDs remotos.

Itens bloqueados não entram no checkpoint como se estivessem processados com sucesso.

## Alternativas Consideradas

- Misturar tudo no checkpoint atual
  - Vantagens: menos arquivos.
  - Desvantagens: semântica confusa, baixa auditabilidade.
  - Motivo de rejeição: não suporta revisão humana confiável.
- Persistir tudo no destino
  - Vantagens: centralização.
  - Desvantagens: depende de contratos inexistentes.
  - Motivo de rejeição: prematuro e inseguro.

## Consequências

### Benefícios Esperados

- Melhor recuperação operacional.
- Trilhas de auditoria claras e reprocessáveis.
- Menor risco de misturar sucesso, bloqueio e replay.

### Trade-offs e Custos

- Mais artefatos locais para gerenciar.
- Necessidade de gravação atômica e convenções de diretório.

### Riscos e Mitigações

- Risco: artefato local corrompido.
  Mitigação: escrita atômica, versionamento simples e testes de recuperação.

## Plano de Implementação

1. Implementar novas portas.
2. Migrar checkpoint atual para `ProgressStore`.
3. Criar writers sanitizados para review artifacts e bindings.

## Monitoramento e Validação

- Medir falhas de persistência.
- Validar que bloqueios não alteram o checkpoint de sucesso.

## Impacto em Documentação e Operação

- Documentar caminhos de arquivos, retenção e procedimento de reprocessamento.

## Revisão Futura

Revisitar quando existir backend central para quarentena e review.


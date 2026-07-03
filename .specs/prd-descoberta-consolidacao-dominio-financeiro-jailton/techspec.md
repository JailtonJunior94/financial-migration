<!-- spec-hash-prd: bb463af4b673d04a6b3e3f52b9675a093c2c6d9bf5886e21974073d932b31e29 -->
<!-- MANDATÓRIO: preenchido por `create-technical-specification` Etapa 7.1 com sha256 do PRD consumido.
     Rastreabilidade: `create-tasks` e `execute-task` comparam este hash com o atual do prd.md
     para detectar drift entre techspec e PRD. NÃO remover este comentário ao editar a techspec. -->

# Especificação Técnica

## Resumo Executivo

Esta funcionalidade substitui o fluxo piloto genérico por um pipeline explícito de `discovery -> consolidation -> classification -> publication`, preservando a arquitetura hexagonal do repositório. O sistema continuará lendo apenas em modo somente leitura nos SQL Servers legados, mas deixará de tratar tabelas como entidades genéricas e passará a modelar fatos financeiros canônicos, elegibilidade do usuário, reconciliação cross-source, classificação e publicação idempotente no destino.

A solução técnica publicará cartões primeiro e publicará todos os fatos financeiros elegíveis como `transactions` na API `mecontrola`. `Invoice` e outros agregados mensais serão usados para reconciliação e validação de totais, não como recursos publicáveis autônomos. Conflitos materiais, dúvidas de método de pagamento, ausência de taxonomia válida ou divergência com o destino serão bloqueados e persistidos em artefatos locais sanitizados, separados dos checkpoints operacionais.

## Arquitetura do Sistema

### Visão Geral dos Componentes

Componentes novos ou substancialmente modificados:

- `src/domain/discovery/*`
  Responsável por modelar metadados de tabela, amostras sanitizadas, cardinalidade e matriz de leitura.
- `src/domain/consolidation/*`
  Responsável por agregados canônicos, vínculo de usuário, chaves de negócio, reconciliação, conflitos e valores monetários.
- `src/domain/classification/*`
  Responsável por categoria, subcategoria, forma de pagamento e estados de classificação.
- `src/domain/publication/*`
  Responsável por comandos publicáveis, fingerprint canônico, estado de reconciliação com o destino e decisões de bloqueio.
- `src/application/use-cases/discover-financial-domain.ts`
  Orquestra leitura de metadados, amostras e cardinalidade das tabelas em escopo.
- `src/application/use-cases/build-eligibility-scope.ts`
  Resolve o universo do usuário destino e produz evidências auditáveis por tabela e por fato.
- `src/application/use-cases/consolidate-financial-facts.ts`
  Constrói cartões consolidados, transações canônicas e issues de reconciliação.
- `src/application/use-cases/classify-consolidated-transactions.ts`
  Resolve categoria, subcategoria e método de pagamento com base na taxonomia destino e em regras determinísticas.
- `src/application/use-cases/publish-cards.ts`
  Faz lookup de cartões no destino, cria apenas quando necessário e persiste o vínculo legado-remoto.
- `src/application/use-cases/publish-transactions.ts`
  Faz reconciliação por `GET` antes de `POST`, decide publicar, pular ou bloquear e atualiza progresso.
- `src/adapters/sqlserver/*`
  Deixará de expor apenas um reader piloto por tabela e passará a expor queries específicas por conjunto de fatos e por usuário elegível.
- `src/adapters/http/mecontrola-*`
  Novos adapters HTTP especializados para categorias, cartões e transações.
- `src/adapters/checkpoint/*`
  Checkpoint operacional passa a ser separado da trilha de revisão manual e dos vínculos remotos.
- `src/bootstrap/cli.ts`
  Passará a expor comandos explícitos para descoberta, consolidação, classificação, publicação de cartões, publicação de transações e listagem de bloqueios.

Fluxo de dados:

1. Descoberta lê metadados e amostras sanitizadas das tabelas em escopo.
2. Elegibilidade resolve quais usuários legados `Jailton` pertencem ao destino e quais fatos entram ou são bloqueados.
3. Consolidação transforma linhas legadas em fatos canônicos por tipo, criando `CanonicalFactKey`.
4. Classificação consulta taxonomia no destino, aplica matriz determinística e produz payload publicável.
5. Publicação cadastra cartões primeiro.
6. Publicação de transações faz `GET` por chave de negócio, decide reconciliar ou publicar, usa `Idempotency-Key` determinística e grava progresso.
7. Itens inelegíveis ou divergentes são gravados em artefatos locais sanitizados separados de checkpoint.

## Design de Implementação

### Interfaces Chave

```ts
export interface SourceDomainDiscoveryPort {
  inspectScope(): Promise<FinancialDiscoverySnapshot>;
}

export interface LegacyFinancialFactReaderPort {
  readEligibleFacts(input: ReadEligibleFactsInput): Promise<LegacyFactBatch>;
}

export interface CategoryCatalogPort {
  listByKind(kind: "expense" | "income"): Promise<CategoryCatalog>;
  searchDictionary(input: CategoryDictionarySearch): Promise<CategoryDictionaryPage>;
}

export interface CardTargetPort {
  findByBusinessKey(input: CardBusinessKey): Promise<RemoteCardMatch | undefined>;
  create(input: PublishableCard, idempotencyKey: string): Promise<RemoteCardRecord>;
}

export interface TransactionTargetPort {
  findByBusinessKey(input: TransactionBusinessKey): Promise<RemoteTransactionMatch | undefined>;
  create(input: PublishableTransaction, idempotencyKey: string): Promise<RemoteTransactionRecord>;
}

export interface ProgressStorePort {
  read(scope: string): Promise<PipelineProgress | undefined>;
  write(scope: string, value: PipelineProgress): Promise<void>;
}

export interface ReviewArtifactPort {
  append(issue: ReviewableIssue): Promise<void>;
}

export interface RemoteBindingStorePort {
  readCard(ref: LegacySourceRef): Promise<RemoteCardBinding | undefined>;
  writeCard(binding: RemoteCardBinding): Promise<void>;
}
```

### Modelos de Dados

Entidades e value objects centrais:

- `UserEligibilityScope`
  Campos: `targetUser`, `matchedLegacyUsers`, `evidence`, `status`.
  Invariante: nenhum fato pode ser publicável sem `eligible` ou sem exceção afirmativa conhecida.

- `LegacySourceRef`
  Campos: `database`, `table`, `primaryKey`.
  Usado em rastreabilidade, bindings remotos e issues.

- `CanonicalFactKey`
  Campos: `resource`, `userId`, `occurredOn`, `normalizedDescription`, `normalizedAmount`, `paymentContext`, `installmentContext`.
  Invariante: deve ser determinística para o mesmo fato econômico cross-source.

- `MoneyAmount`
  Campos: `minorUnits`, `scale`, `currency`.
  Regra: conversão para decimal de precisão fixa com half-even obrigatória; nunca usar `float` diretamente no domínio consolidado.

- `OccurrenceDate`
  Campos: `value`, `sourceField`, `fallbackUsed`.
  Regra: usa a data do fato; `createdAt` só entra como fallback explícito.

- `ConsolidatedCard`
  Campos: `businessKey`, `displayName`, `closingDay`, `expirationDate`, `legacyRefs`, `ownerEvidence`, `reconciliationStatus`.

- `ConsolidatedTransaction`
  Campos: `factKey`, `kind`, `occurredOn`, `competence`, `description`, `amount`, `categoryCandidate`, `subcategoryCandidate`, `paymentMethod`, `cardBinding`, `installmentPlan`, `legacyRefs`, `sourceSummary`.

- `InstallmentPlan`
  Campos: `groupKey`, `currentInstallment`, `totalInstallments`.
  Regra: cada parcela efetiva vira uma `transaction` independente.

- `ReviewableIssue`
  Campos: `issueId`, `kind`, `severity`, `factKey?`, `legacyRefs`, `reason`, `evidence`, `blockedAt`.
  Tipos: `user-eligibility`, `reconciliation-conflict`, `missing-income-taxonomy`, `unknown-payment-method`, `destination-divergence`, `semantic-mismatch`.

Mapeamento por origem:

- `FinancialControlDB.Card` e `AccountControlDB.Cards` alimentam `ConsolidatedCard`.
- `FinancialControlDB.InvoiceItem` é a fonte detalhada primária de transações de cartão.
- `FinancialControlDB.Invoice` e `AccountControlDB.Invoices` existem para competência, reconciliação e totalização, não para publicação direta.
- `FinancialControlDB.TransactionItem` é a fonte detalhada primária de transações correntes.
- `FinancialControlDB.Transaction` e `AccountControlDB.Accounts` alimentam reconciliação de movimentos correntes; `Accounts` entra por regra afirmativa de pertencimento ao universo `Jailton`.
- `FinancialControlDB.Bill` e `BillItem` entram como `transactions` não-cartão e dependem de categoria/subcategoria + método de pagamento para diferenciação semântica.

### Endpoints de API

Endpoints consultados/publicados no destino:

- `GET /api/v1/categories?kind={expense|income}&include_deprecated=false`
  Fonte de verdade para categorias raiz e subcategorias.
- `GET /api/v1/categories/:id?include_deprecated=false`
  Resolução de detalhe e validação de categoria escolhida.
- `GET /api/v1/category-dictionary?kind={expense|income}&page_size={n}`
  Dicionário auxiliar para classificação semântica.
- `GET /api/v1/category-dictionary/search?...`
  Busca por termos conhecidos.
- `GET /api/v1/cards`
  Lookup por chave de negócio normalizada quando o contrato do repositório `mecontrola` confirmar os filtros suportados.
- `POST /api/v1/cards`
  Cadastro prévio de cartão.
- `GET /api/v1/transactions`
  Reconciliação pré-publicação por chave de negócio representável nos filtros/consulta da API ou por binding local já persistido.
- `POST /api/v1/transactions`
  Publicação única dos fatos financeiros.
- `GET /api/v1/cards/:card_id/invoices/:ref_month`
  Validação pós-publicação de coerência mensal quando aplicável ao cartão.

Headers obrigatórios:

- `X-User-ID`
- `X-Gateway-Timestamp`
- `X-Gateway-Auth`
- `Idempotency-Key` nas mutações
- `Content-Type: application/json`

O algoritmo de `X-Gateway-Auth` seguirá a convenção observada no repositório `/Users/jailtonjunior/Git/mecontrola`: HMAC-SHA256 hex sobre `user_id.toLowerCase() + "." + timestamp`, usando `gatewaySecretHex`.

## Pontos de Integração

- SQL Server `AccountControlDB`
  Somente leitura. Queries específicas por tabela e por universo elegível.
- SQL Server `FinancialControlDB`
  Somente leitura. Queries específicas por fato e por relacionamento.
- API `https://api.mecontrola.app.br`
  Leitura de taxonomia, lookup de cartões, lookup de transações, criação de cartões e criação de transações.
- Repositório `/Users/jailtonjunior/Git/mecontrola`
  Fonte de verdade local para convenções de payload, monetização, sinal, arredondamento e comportamento de autenticação observado na collection/Postman e código associado.
- OpenRouter
  Uso somente como apoio de clarificação semântica para sugestão de categoria/subcategoria; nunca decide publicação final sozinho.

Tratamento de falhas:

- Falha de leitura nas fontes: erro tipado `SOURCE_READ_FAILURE`, interrompe o estágio corrente.
- Falha de taxonomia ou ausência de cobertura `income`: bloqueia fatos afetados e persiste issue.
- Divergência material entre legado consolidado e destino já existente: bloqueia, registra issue e segue os demais fatos.
- Falha transiente no destino: retry limitado e explícito apenas para leitura e criação idempotente.
- Falha entre `POST` e persistência local de progresso: replay permitido, protegido por `GET-before-POST` e `Idempotency-Key`.

## Abordagem de Testes

### Testes Unitários

Cobertura obrigatória:

- Value objects: `MoneyAmount`, `OccurrenceDate`, `CanonicalFactKey`, `InstallmentPlan`.
- Elegibilidade do usuário `Jailton`, incluindo exceção afirmativa de `Accounts`.
- Consolidação cross-source por tipo de fato.
- Regras de forma de pagamento.
- Classificação de categoria/subcategoria com cobertura de `expense`, `income`, ausência de taxonomia e fallback bloqueante.
- Reconciliação com destino: equivalente, divergente e inexistente.
- Fingerprint/idempotência canônica estável.

### Testes de Integração

Adotados. O projeto tem fronteiras críticas de IO, já existe risco concreto de falha por diferença entre mocks e contrato real, e o custo de manter testes de integração locais é proporcional ao risco.

Escopo:

- Adapter SQL Server com fixtures estáveis ou smoke local restrito às queries montadas.
- Progress store e review artifact store com filesystem temporário, gravação atômica e recuperação de corrupção.
- Adapter HTTP de categorias, cartões e transações com servidor fake local validando headers obrigatórios, `Idempotency-Key`, respostas equivalentes e divergentes.
- Bootstrap/CLI por comando para garantir que `checkpoint:list/reset` não dependam do runtime completo da API.

### Testes E2E

Não são necessários nesta fase. O equivalente operacional será um fluxo de validação controlado contra ambiente de homologação ou dataset reduzido, fora do gate automatizado padrão.

## Sequenciamento de Desenvolvimento

### Ordem de Build

1. Reestruturar domínio e portas.
   Primeiro porque todo o restante depende de `CanonicalFactKey`, `MoneyAmount`, elegibilidade, consolidação e estados de bloqueio.
2. Implementar descoberta e elegibilidade.
   Necessário para obter fatos sanitizados e universo de usuário confiável.
3. Implementar consolidação e classificação.
   Produz o formato canônico antes de qualquer integração remota.
4. Implementar cadastro de cartões.
   É pré-requisito para transações vinculadas a cartão.
5. Implementar publicação de transações.
   Depende de cartões, taxonomia, reconciliação e bindings locais.
6. Implementar observabilidade, review artifacts e comandos operacionais.
   Fecha o ciclo de produção com retomada segura e auditabilidade.

### Dependências Técnicas

- Credenciais de leitura válidas para ambos os SQL Servers.
- `X-User-ID` e `gatewaySecretHex` válidos para a API destino.
- Confirmação no repositório `mecontrola` dos campos exatos de payload de `cards` e `transactions`.
- Contrato OpenAPI ou implementação manual baseada na collection para recursos reais da API.

## Monitoramento e Observabilidade

Logs estruturados obrigatórios:

- início e fim de cada estágio;
- totais por lote;
- `published`, `reconciled`, `blocked`, `skipped`, `duplicates`, `replayed`;
- latência de requests HTTP;
- contagem por categoria de issue.

Métricas mínimas:

- `migration_batches_total`
- `migration_facts_processed_total`
- `migration_facts_blocked_total`
- `migration_remote_duplicates_total`
- `migration_http_requests_total`
- `migration_http_request_duration_ms`
- `migration_checkpoint_write_failures_total`

Artefatos operacionais:

- `checkpoints/*.json`
  Apenas progresso operacional.
- `tmp/review-artifacts/*.ndjson`
  Issues sanitizadas, reprocessáveis e separadas de checkpoint.
- `tmp/remote-bindings/*.json`
  Vínculos `legacy card -> remote card id` e, quando aplicável, bindings adicionais.

## Considerações Técnicas

### Decisões Chave

- O pipeline passa a ser separado em `discovery`, `consolidation`, `classification` e `publication`.
- `transactions` é o destino único dos fatos financeiros publicáveis; `cards` é pré-cadastro auxiliar.
- A chave de reconciliação é de negócio, não de origem bruta.
- A publicação é `GET-before-POST`, com bloqueio para divergência material.
- Checkpoint operacional, review artifacts e remote bindings ficam separados.
- `Bill` e `BillItem` entram em `transactions`, diferenciados por categoria/subcategoria e forma de pagamento, não por recurso destino distinto.

ADRs relacionadas:

- `adr-001-pipeline-transactions-unificadas.md`
- `adr-002-reconciliacao-e-idempotencia.md`
- `adr-003-review-artifacts-e-progress-store.md`
- `adr-004-cadastro-previo-de-cartoes.md`

### Riscos Conhecidos

- O contrato OpenAPI local ainda representa `/records` e não a API real observada.
  Mitigação: regenerar contrato ou usar adapter manual temporário baseado em collection.
- A taxonomia `income` pode ser insuficiente.
  Mitigação: bloquear receitas até confirmação válida.
- Algumas tabelas legadas usam `float`.
  Mitigação: normalização imediata para `MoneyAmount` com half-even.
- A API pode não expor filtro suficiente para lookup por chave de negócio.
  Mitigação: manter binding local e lógica de reconciliação incremental por leitura suportada.

### Conformidade com Padrões

- `AGENTS.md`: arquitetura hexagonal, Bun, TypeScript estrito, menor mudança segura e validação proporcional.
- `agent-governance`:
  - `R-DDD-001`
  - `R-SEC-001`
  - `R-TEST-001`
  - `R-ERR-001`
- `node-implementation`:
  - R0 strict obrigatório
  - R3 erros tipados
  - R4 promises sem vazamento
  - R5 validação de input externo
  - R6 DI por construtor e fronteiras por interface
  - R7 testes para todo comportamento

### Arquivos Relevantes e Dependentes

- `src/bootstrap/cli.ts`
- `src/bootstrap/composition/create-runtime.ts`
- `src/bootstrap/config.ts`
- `src/application/ports/*.ts`
- `src/application/use-cases/*.ts`
- `src/domain/common/*.ts`
- `src/domain/schema/*.ts`
- `src/domain/sync/*.ts`
- `src/adapters/sqlserver/*.ts`
- `src/adapters/http/openapi-target-service.ts`
- `src/adapters/checkpoint/*.ts`
- `test/**/*.test.ts`
- `openapi/target-service.openapi.json`
- `/Users/jailtonjunior/Git/mecontrola/docs/postman/mecontrola-api.completo.postman_collection.json`

## Mapeamento Requisito -> Decisão -> Teste

| Requisito | Decisão Técnica | Validação |
| --- | --- | --- |
| RF-01 a RF-04 | `SourceDomainDiscoveryPort` + readers específicos com amostras/cardinalidade | testes de integração dos adapters SQL Server |
| RF-06 a RF-08 | `CanonicalFactKey`, agregados canônicos e `ReviewableIssue` | unitários de consolidação e conflito |
| RF-09 a RF-13A | `UserEligibilityScope` + exceção afirmativa de `Accounts` | unitários de elegibilidade |
| RF-13 e RF-40 | cadastro prévio de cartões com binding local | unitários + integração HTTP de cards |
| RF-14 a RF-16, RF-33 a RF-35 | destino único `transactions`, `Invoice` só para reconciliação, `InvoiceItem` publicável | unitários de mapeamento e reconciliação |
| RF-17 a RF-20 | adapters de categorias + apoio do OpenRouter sem autonomia decisória | integração HTTP + unitários de classificação |
| RF-21, RF-22, RF-39 | `GET-before-POST`, binding local, bloqueio em divergência | integração HTTP + unitários de reconciliação |
| RF-23 a RF-25 | matriz por tabela e trilha de auditoria | unitários + snapshots sanitizados |
| RF-27 a RF-29 | leitura somente, segredos fora do código, stores separados | revisão de config + testes de adapters |
| RF-31 e RF-32 | `OccurrenceDate` | unitários de data canônica |
| RF-36 | `MoneyAmount` com half-even | unitários monetários |
| RF-37 | `InstallmentPlan` e publicação por parcela efetiva | unitários de parcelamento |
| RF-38 | matriz determinística de forma de pagamento | unitários de payment method |


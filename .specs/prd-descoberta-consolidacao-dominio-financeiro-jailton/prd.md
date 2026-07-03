<!-- spec-version: 2 -->

# Documento de Requisitos do Produto (PRD)

## Visão Geral

Este PRD define a funcionalidade de descoberta e consolidação de domínio financeiro em modo somente leitura para preparar uma carga inicial confiável no serviço destino `https://api.mecontrola.app.br`.

O produto deve ler DDL, constraints, índices e amostras representativas de dados de duas origens SQL Server, `AccountControlDB` e `FinancialControlDB`, entender o domínio real de cartões, faturas, compras, contas e transações, reconciliar sobreposições entre os legados e produzir um mapeamento validável para os recursos da API destino.

O ator principal é o operador interno de migração. O resultado de negócio esperado desta fase não é executar a ingestão em produção, e sim entregar uma especificação sem lacunas para a futura implementação de leitura, classificação e publicação via API para o usuário destino `06edc407-4f63-42e8-b07c-946b9ef0a19c`.

## Objetivos

- Produzir entendimento confiável do domínio financeiro existente nas duas bases legadas apenas com acesso de leitura.
- Definir uma regra determinística de consolidação entre registros sobrepostos de `AccountControlDB` e `FinancialControlDB`.
- Definir critérios inequívocos para selecionar apenas dados atribuíveis ao universo de usuários legados cujo nome contenha `Jailton`, com confirmação por segundo sinal forte.
- Mapear o domínio consolidado para o cadastro prévio de `cards`, para o recurso destino `transactions` como destino único dos fatos financeiros publicáveis, e para os recursos auxiliares `categories` e `category-dictionary`.
- Definir critérios objetivos para a futura ingestão sem permitir falso positivo, mistura de tenant ou classificação automática inconsistente.

Métricas de sucesso desta fase:

- 100% das tabelas listadas no escopo com estrutura, cardinalidade básica e semântica de negócio documentadas.
- 100% das entidades de destino previstas com origem canônica, regra de reconciliação e critério de bloqueio definidos.
- 0 requisitos pendentes para seleção de tenant, reconciliação de conflito, classificação e preparo da futura ingestão.
- 0 permissão de escrita nas fontes legadas durante descoberta e consolidação.

## Histórias de Usuário

- Como operador interno de migração, quero inspecionar as duas bases legadas em modo somente leitura para entender com precisão o domínio e evitar decisões erradas de modelagem.
- Como operador interno de migração, quero consolidar fatos financeiros equivalentes entre dois legados para preparar uma visão única e coerente do histórico do usuário destino.
- Como operador interno de migração, quero identificar apenas registros realmente pertencentes ao universo de usuários `Jailton` relevantes para o destino para evitar contaminação de tenant.
- Como operador interno de migração, quero classificar despesas e receitas com base na taxonomia da API destino para garantir aderência semântica antes da futura publicação.
- Como responsável pelo serviço destino, quero que conflitos materiais entre fontes sejam bloqueados para revisão manual, em vez de resolvidos automaticamente com risco de falso positivo.

## Funcionalidades Core

- Descoberta de esquema e dados em leitura.
  O produto deve ler colunas, tipos, nulabilidade, chaves, índices e amostras representativas das tabelas listadas para inferir o domínio real.

- Modelagem de domínio consolidada.
  O produto deve transformar os achados estruturais em um modelo de domínio explícito e auditável, com separação clara entre agregados, itens e relacionamentos. A modelagem deve seguir princípios de domain modeling funcional para privilegiar estados válidos, transições explícitas e invariantes de negócio.

- Seleção segura do universo do usuário destino.
  O produto deve partir dos usuários legados cujo nome contenha `Jailton`, normalizando variações, e só considerar registros elegíveis quando houver ao menos um segundo sinal forte de confirmação.

- Regra afirmativa para contas legadas.
  O produto deve tratar todos os registros de `AccountControlDB.Accounts` como pertencentes ao universo do usuário `Jailton`, conforme regra de negócio afirmada pelo solicitante.

- Reconciliação entre legados.
  O produto deve tratar `AccountControlDB` e `FinancialControlDB` como fontes igualmente canônicas e consolidar registros equivalentes por regras explícitas. Quando houver conflito material sobre o mesmo fato financeiro, o item deve ser bloqueado para revisão manual.

- Preparação de mapeamento para API destino.
  O produto deve produzir o mapeamento entre entidades consolidadas e os recursos da API `mecontrola`, usando `cards` como cadastro prévio auxiliar e `transactions` como destino único dos fatos financeiros publicáveis, inclusive com regras de enriquecimento por categoria, subcategoria e forma de pagamento.

- Classificação assistida e validada.
  O produto deve usar `categories` e `category-dictionary` como fonte de verdade para classificação; o OpenRouter pode sugerir hipóteses de mapeamento, mas nunca decidir categoria final de forma autônoma.

## Requisitos Funcionais

- RF-01: O produto deve acessar em modo somente leitura as tabelas `Cards`, `Accounts` e `Invoices` da origem `AccountControlDB`.
- RF-02: O produto deve acessar em modo somente leitura as tabelas `Bill`, `BillItem`, `Card`, `Invoice`, `InvoiceItem`, `Transaction` e `TransactionItem` da origem `FinancialControlDB`.
- RF-03: O produto deve ler, para cada tabela em escopo, DDL lógico suficiente para documentar colunas, tipos, nulabilidade, chaves, índices e relacionamentos observáveis.
- RF-04: O produto deve ler amostras representativas e cardinalidade básica das tabelas em escopo sem copiar massa completa nem persistir snapshots brutos fora dos sistemas autorizados.
- RF-05: O produto deve documentar o papel de cada entidade fonte no domínio consolidado.
- RF-06: O produto deve tratar `AccountControlDB` e `FinancialControlDB` como fontes igualmente canônicas para entidades sobrepostas.
- RF-07: O produto deve definir regras explícitas de consolidação para fatos equivalentes entre as duas fontes.
- RF-08: O produto deve bloquear para revisão manual qualquer fato financeiro com conflito material entre as duas origens, proibindo classificação e ingestão automáticas desse item.
- RF-09: O produto deve iniciar a seleção de tenant legado buscando usuários cujo nome contenha `Jailton`, com comparação case-insensitive e normalização de variações e acentos.
- RF-10: O produto só deve considerar um usuário legado elegível quando houver ao menos um segundo sinal forte de confirmação, como e-mail, telefone, cartão, histórico recorrente ou relacionamento consistente entre tabelas.
- RF-11: O produto deve limitar o universo de dados elegíveis ao usuário destino `06edc407-4f63-42e8-b07c-946b9ef0a19c`, evitando mistura com outros tenants.
- RF-12: O produto deve considerar o usuário destino identificado por `id = 06edc407-4f63-42e8-b07c-946b9ef0a19c`, `email = jailton.junior94@outlook.com`, `whatsapp_number = +5511986896322` e `status = ACTIVE` como destino de referência desta iniciativa.
- RF-13: O produto deve mapear cartões consolidados para o recurso destino `cards`, com cadastro prévio antes da publicação dos fatos financeiros que dependam desse vínculo.
- RF-13A: O produto deve tratar todos os registros de `AccountControlDB.Accounts` como pertencentes ao universo elegível do usuário destino, sem exigir sinal adicional de confirmação para essa tabela específica.
- RF-14: O produto deve mapear compras de fatura e itens parcelados consolidados para o recurso destino `transactions`, preservando vínculo com cartão, competência e parcelamento quando aplicável.
- RF-15: O produto deve usar faturas consolidadas por cartão e competência para reconciliação e validação de totais, evitando dupla contagem na publicação do destino.
- RF-16: O produto deve mapear movimentos correntes consolidados para o recurso destino `transactions`.
- RF-17: O produto deve usar os endpoints `GET /api/v1/categories`, `GET /api/v1/categories/:id`, `GET /api/v1/category-dictionary` e `GET /api/v1/category-dictionary/search` para obter a taxonomia destino aplicável.
- RF-18: O produto deve tratar a taxonomia da API destino como fonte de verdade para a classificação final.
- RF-19: O produto deve classificar obrigatoriamente despesas e receitas nesta iniciativa, desde que a taxonomia do destino confirme cobertura para ambos os tipos durante a descoberta.
- RF-20: O produto pode usar OpenRouter apenas para sugerir correspondências semânticas ou esclarecer ambiguidades de descrição, sempre sujeito a validação final contra a taxonomia real do destino.
- RF-21: O produto deve produzir critérios objetivos para futura consulta `GET` no destino antes de publicar novos registros, de forma a reduzir duplicidade e apoiar idempotência.
- RF-22: O produto deve produzir critérios objetivos para futura publicação `POST` com rastreabilidade do vínculo entre origem consolidada e recurso criado no destino.
- RF-23: O produto deve registrar explicitamente quais entidades fonte não possuem vínculo de usuário direto e como esse vínculo será inferido de maneira segura por relacionamento consistente.
- RF-24: O produto deve distinguir claramente entre agregados mensais e itens detalhados observados nas origens.
- RF-25: O produto deve documentar diferenças de granularidade entre as bases, incluindo o caráter mais achatado de `AccountControlDB` e o maior detalhamento relacional de `FinancialControlDB`.
- RF-26: O produto deve produzir uma matriz de rastreabilidade entre entidade fonte, regra de consolidação, regra de classificação e recurso destino.
- RF-27: O produto não deve permitir escrita em `AccountControlDB` nem em `FinancialControlDB` em nenhuma etapa desta fase.
- RF-28: O produto não deve persistir dados sensíveis brutos localmente além do mínimo transitório necessário à análise em memória ou artefatos seguros e sanitizados.
- RF-29: O produto deve exigir credenciais e segredos fora do código-fonte e operar sob princípio de menor privilégio.
- RF-30: O produto deve deixar a futura ingestão bloqueada quando o usuário destino não estiver elegível, ativo ou coerente com os sinais fortes reconciliados nas origens.
- RF-31: O produto deve preservar a data original de cadastro ou ocorrência observada na origem ao consolidar fatos elegíveis para futura ingestão, sem sobrescrever esse valor por data de processamento.
- RF-32: O produto deve adotar como data canônica a data de ocorrência do fato financeiro; a data de cadastro na origem só pode ser usada quando não existir data de ocorrência explícita para o fato em questão.
- RF-33: O produto deve tratar `transactions` como destino único dos fatos financeiros publicáveis nesta iniciativa, inclusive fatos oriundos de `Accounts`, `Bill`, `BillItem`, `Transaction`, `TransactionItem` e itens elegíveis ligados a `Invoice`.
- RF-34: O produto deve inferir a forma de pagamento por vínculo estrutural do fato, publicando fatos ligados a `invoice` como transações de cartão e fatos oriundos de `Accounts`, `Bill` e `BillItem` como métodos bancários não-cartão segundo matriz determinística de mapeamento.
- RF-35: O produto deve publicar apenas os fatos detalhados de `InvoiceItem` como `transactions`, usando `Invoice` apenas para reconciliação, competência e validação de totais.
- RF-36: O produto deve normalizar valores monetários para decimal de precisão fixa com arredondamento half-even, sem desvios, usando as convenções do repositório `/Users/jailtonjunior/Git/mecontrola` como referência para sinal, campos monetários e arredondamento.
- RF-37: O produto deve publicar compras parceladas como uma `transaction` por parcela efetiva, preservando índice da parcela, quantidade total de parcelas e vínculo lógico com a compra original.
- RF-38: O produto deve distinguir `pix`, `ted` e outros métodos bancários por matriz determinística baseada em evidência forte da origem; quando o método não puder ser provado, o fato deve ser bloqueado para revisão antes da carga final.
- RF-39: O produto deve, ao encontrar `transaction` já existente no destino para o mesmo fato consolidado, comparar o payload canônico e seguir sem mutação quando equivalente, bloqueando para revisão manual quando houver divergência material.
- RF-40: O produto deve reconhecer cartão por chave de negócio determinística antes da publicação, criando-o no destino apenas quando não existir e persistindo localmente o vínculo entre cartão legado e cartão remoto.

## Experiência do Usuário

Feature apenas backend. A experiência principal é operacional:

- O operador define o usuário destino e executa a descoberta em leitura.
- O operador recebe um panorama consolidado do domínio, incluindo entidades, vínculos, conflitos, classificação, forma de pagamento e possíveis bloqueios.
- O operador consegue verificar quais registros foram aceitos, quais ficaram bloqueados por conflito e quais dependem de revisão humana antes da futura ingestão.
- O operador consegue entender, sem ambiguidade, como cada fato legado seria transformado em recurso do destino.

## Restrições Técnicas de Alto Nível

- As duas fontes legadas são SQL Server e devem ser acessadas exclusivamente em modo leitura.
- O destino é a API `https://api.mecontrola.app.br`.
- A integração destino depende de cabeçalhos e recursos existentes na collection Postman de referência do repositório `/Users/jailtonjunior/Git/mecontrola`.
- A descoberta de categorias deve usar os endpoints reais de categoria do destino como fonte de verdade.
- O OpenRouter é ferramenta auxiliar de esclarecimento semântico, não motor decisório final.
- O produto deve respeitar princípio de menor privilégio, segredos fora do código e proibição de retenção indevida de dados sensíveis brutos.
- A modelagem de domínio deve privilegiar invariantes explícitas e redução de estados inválidos, em linha com abordagem funcional orientada a domínio.
- A solução futura deve preservar isolamento de tenant e impedir mistura de dados entre usuários.
- O cadastro de cartões deve ocorrer antes da publicação das `transactions` que dependam de vínculo de cartão.
- O destino publicável principal é `transactions`; `Invoice` e outros agregados mensais não devem ser publicados como fato financeiro separado quando isso gerar dupla contagem.
- A política monetária deve usar decimal de precisão fixa com arredondamento half-even.

## Fora de Escopo

- Qualquer escrita em `AccountControlDB` ou `FinancialControlDB`.
- Mutação manual em Postgres de destino como mecanismo de migração.
- Execução da ingestão em produção nesta fase.
- Criação automática de usuário destino.
- Ampliação do escopo para entidades não listadas, exceto quando estritamente necessárias para confirmar relacionamento ou sinal forte de usuário.
- Definição detalhada de implementação, escolha de classes, portas, adapters ou desenho de código.
- Operação contínua de produção, scheduling, monitoração final e rotinas operacionais além da descoberta e consolidação.
- Uso do OpenRouter para classificar automaticamente sem validação contra a taxonomia do destino.

## Recomendações

- Priorizar `FinancialControlDB` como referência estrutural para compreender agregados e relações, sem reduzir seu status canônico em relação a `AccountControlDB`.
- Tratar `Invoices` de `AccountControlDB` e `Invoice`/`InvoiceItem` de `FinancialControlDB` como candidatos fortes a representar o mesmo subdomínio em granularidades diferentes, publicando apenas os itens detalhados elegíveis como `transactions`.
- Tratar `Accounts` de `AccountControlDB`, `Bill`/`BillItem` e `Transaction`/`TransactionItem` de `FinancialControlDB` como fatos publicáveis para `transactions`, com diferenciação por categoria, subcategoria e forma de pagamento.
- Validar explicitamente se a taxonomia destino cobre receita e despesa com a mesma qualidade antes de fechar a futura automação de classificação.
- Persistir no desenho futuro uma trilha de auditoria por fato consolidado contendo origem, sinais usados para vínculo de usuário, resultado de reconciliação e decisão de bloqueio ou elegibilidade.
- Definir por entidade a coluna de data de ocorrência canônica antes da implementação, por exemplo `AccountDate`, `PurchaseDate`, `Invoice.Date` ou `Transaction.Date`, deixando `CreatedAt` apenas como fallback quando não houver data de fato.

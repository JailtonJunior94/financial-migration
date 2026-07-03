import type {
  LegacyDatabase,
  TableSemanticMetadata,
  TableSemanticRole,
} from "./types.ts";

type MatrixKey = `${LegacyDatabase}.${string}`;

const buildKey = (database: LegacyDatabase, tableName: string): MatrixKey =>
  `${database}.${tableName}`;

const roleMatrix: Readonly<Record<MatrixKey, TableSemanticMetadata>> = {
  "AccountControlDB.Cards": {
    role: "card_register",
    granularity: "register",
    hasDirectUserLink: true,
    rationale:
      "Cadastro de cartões no legado AccountControlDB; alimenta o cadastro prévio de cards no destino.",
    risks: [
      "Possível duplicação com FinancialControlDB.Card exige reconciliação por chave de negócio.",
      "Números de cartão devem ser mascarados no snapshot sanitizado.",
    ],
  },
  "AccountControlDB.Accounts": {
    role: "account_register",
    granularity: "register",
    hasDirectUserLink: true,
    rationale:
      "Registros bancários/correntes do legado AccountControlDB; tratados como pertencentes ao universo Jailton por regra afirmativa (RF-13A).",
    risks: [
      "Ausência de sinal forte de confirmação é suprida pela regra de negócio afirmativa; não replicar essa exceção para outras tabelas.",
      "Granularidade mais achatada que FinancialControlDB exige atenção à dupla contagem.",
    ],
  },
  "AccountControlDB.Invoices": {
    role: "invoice_header",
    granularity: "aggregate",
    hasDirectUserLink: false,
    userLinkInference:
      "Via relacionamento com AccountControlDB.Cards/Accounts e competência do fato.",
    rationale:
      "Agregado mensal de fatura no legado AccountControlDB; usado para reconciliação, competência e validação de totais, não para publicação direta.",
    risks: [
      "Publicar o header como fato financeiro causaria dupla contagem com os itens.",
      "Estrutura mais achatada pode dificultar a separação entre header e itens.",
    ],
  },
  "FinancialControlDB.Bill": {
    role: "bill_header",
    granularity: "aggregate",
    hasDirectUserLink: false,
    userLinkInference:
      "Via BillItem e relacionamento recorrente com usuário/tabela de cadastro.",
    rationale:
      "Agregado de conta/despesa no legado FinancialControlDB; fonte de contexto para os itens publicáveis.",
    risks: [
      "Header não deve ser publicado como transaction independente.",
      "Vínculo de usuário pode depender de inferência indireta.",
    ],
  },
  "FinancialControlDB.BillItem": {
    role: "bill_item",
    granularity: "detail",
    hasDirectUserLink: false,
    userLinkInference:
      "Via Bill header e evidência consistente de usuário nos itens relacionados.",
    rationale:
      "Itens detalhados de conta/despesa; publicáveis como transactions não-cartão, diferenciados por categoria/subcategoria e forma de pagamento.",
    risks: [
      "Diferenciação entre pix, ted e transferências bancárias exige evidência forte da origem.",
      "Ausência de taxonomia de income pode bloquear receitas.",
    ],
  },
  "FinancialControlDB.Card": {
    role: "card_register",
    granularity: "register",
    hasDirectUserLink: true,
    rationale:
      "Cadastro de cartões no legado FinancialControlDB; fonte canônica estrutural para consolidação de cards.",
    risks: [
      "Possível duplicação com AccountControlDB.Cards exige reconciliação por chave de negócio.",
      "Números de cartão devem ser mascarados no snapshot sanitizado.",
    ],
  },
  "FinancialControlDB.Invoice": {
    role: "invoice_header",
    granularity: "aggregate",
    hasDirectUserLink: false,
    userLinkInference: "Via InvoiceItem, Card e competência do fato.",
    rationale:
      "Agregado mensal de fatura no legado FinancialControlDB; usado para reconciliação, competência e validação de totais.",
    risks: [
      "Publicar o header como fato financeiro causaria dupla contagem.",
      "Relacionamento Card -> Invoice -> InvoiceItem define o vínculo de usuário e cartão.",
    ],
  },
  "FinancialControlDB.InvoiceItem": {
    role: "invoice_item",
    granularity: "detail",
    hasDirectUserLink: false,
    userLinkInference: "Via Invoice header e Card relacionado.",
    rationale:
      "Itens detalhados de fatura de cartão; publicáveis como transactions de cartão, com parcelamento e competência.",
    risks: [
      "Cada parcela efetiva deve virar uma transaction independente.",
      "Conflitos materiais com AccountControlDB.Invoices devem ser bloqueados para revisão manual.",
    ],
  },
  "FinancialControlDB.Transaction": {
    role: "transaction_header",
    granularity: "aggregate",
    hasDirectUserLink: false,
    userLinkInference:
      "Via TransactionItem e relacionamento consistente com usuário.",
    rationale:
      "Agregado de movimentação corrente no legado FinancialControlDB; usado para contexto e reconciliação dos itens.",
    risks: [
      "Header não deve ser publicado como fato financeiro independente.",
      "Diferenciação de método de pagamento bancário exige sinais fortes.",
    ],
  },
  "FinancialControlDB.TransactionItem": {
    role: "transaction_item",
    granularity: "detail",
    hasDirectUserLink: false,
    userLinkInference:
      "Via Transaction header e evidência de usuário nos itens.",
    rationale:
      "Itens detalhados de movimentação corrente; publicáveis como transactions não-cartão.",
    risks: [
      "Diferenciação entre pix, ted e outras transferências deve ser determinística.",
      "Ausência de data de ocorrência exige fallback para CreatedAt com marcação explícita.",
    ],
  },
};

export const resolveSemanticMetadata = (
  database: LegacyDatabase,
  tableName: string,
): TableSemanticMetadata => {
  const metadata = roleMatrix[buildKey(database, tableName)];
  if (metadata) {
    return metadata;
  }

  return {
    role: "unknown",
    granularity: "register",
    hasDirectUserLink: false,
    rationale:
      "Tabela fora da matriz semântica conhecida; requer revisão manual.",
    risks: [
      "Papel semântico não mapeado; não publicar até classificação segura.",
    ],
  };
};

export const resolveSemanticRole = (
  database: LegacyDatabase,
  tableName: string,
): TableSemanticRole => resolveSemanticMetadata(database, tableName).role;

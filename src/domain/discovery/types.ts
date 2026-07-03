export type LegacyDatabase = "AccountControlDB" | "FinancialControlDB";

export type TableColumnMetadata = {
  readonly columnName: string;
  readonly dataType: string;
  readonly isNullable: boolean;
  readonly isPrimaryKey: boolean;
  readonly isIndexed: boolean;
  readonly foreignKeyTarget?: {
    readonly table: string;
    readonly column: string;
  };
};

export type TableIndexMetadata = {
  readonly indexName: string;
  readonly columns: readonly string[];
  readonly isUnique: boolean;
  readonly isPrimaryKey: boolean;
};

export type TableSemanticRole =
  | "card_register"
  | "account_register"
  | "invoice_header"
  | "invoice_item"
  | "transaction_header"
  | "transaction_item"
  | "bill_header"
  | "bill_item"
  | "unknown";

export type TableGranularity = "aggregate" | "detail" | "register";

export type TableSemanticMetadata = {
  readonly role: TableSemanticRole;
  readonly granularity: TableGranularity;
  readonly hasDirectUserLink: boolean;
  readonly userLinkInference?: string;
  readonly rationale: string;
  readonly risks: readonly string[];
};

export type TableDiscoveryMetadata = {
  readonly database: LegacyDatabase;
  readonly schemaName: string;
  readonly tableName: string;
  readonly columns: readonly TableColumnMetadata[];
  readonly indexes: readonly TableIndexMetadata[];
  readonly estimatedRowCount: number;
  readonly sampleSize: number;
};

export type SanitizedSample = {
  readonly database: LegacyDatabase;
  readonly tableName: string;
  readonly primaryKey: string;
  readonly fields: Record<string, unknown>;
};

export type TableDiscoverySnapshot = {
  readonly metadata: TableDiscoveryMetadata;
  readonly semantic: TableSemanticMetadata;
  readonly samples: readonly SanitizedSample[];
};

export type FinancialDiscoverySnapshot = {
  readonly discoveredAt: string;
  readonly databases: readonly LegacyDatabase[];
  readonly tables: readonly TableDiscoverySnapshot[];
};

export type TableRoleMapping = {
  readonly database: LegacyDatabase;
  readonly tableName: string;
  readonly role: TableSemanticRole;
  readonly rationale: string;
};

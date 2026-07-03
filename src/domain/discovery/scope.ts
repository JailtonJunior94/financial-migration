import type { LegacyDatabase } from "./types.ts";

export const DISCOVERY_DATABASES: readonly LegacyDatabase[] = [
  "AccountControlDB",
  "FinancialControlDB",
];

export const DISCOVERY_SCOPE: Readonly<
  Record<LegacyDatabase, readonly string[]>
> = {
  AccountControlDB: ["Cards", "Accounts", "Invoices"],
  FinancialControlDB: [
    "Bill",
    "BillItem",
    "Card",
    "Invoice",
    "InvoiceItem",
    "Transaction",
    "TransactionItem",
  ],
};

export const isTableInScope = (
  database: LegacyDatabase,
  tableName: string,
): boolean => DISCOVERY_SCOPE[database].includes(tableName);

export const expectedTableCount = (): number =>
  DISCOVERY_DATABASES.reduce(
    (total, database) => total + DISCOVERY_SCOPE[database].length,
    0,
  );

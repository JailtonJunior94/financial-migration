import { beforeEach, describe, expect, test } from "bun:test";
import type { SourceDomainDiscoveryPort } from "../../src/application/ports/source-domain-discovery-port.ts";
import { DiscoverFinancialDomainUseCase } from "../../src/application/use-cases/discover-financial-domain.ts";
import type {
  FinancialDiscoverySnapshot,
  LegacyDatabase,
  TableDiscoverySnapshot,
} from "../../src/domain/discovery/types.ts";

const makeSnapshot = (
  database: LegacyDatabase,
  tableNames: readonly string[],
): FinancialDiscoverySnapshot => ({
  discoveredAt: "2026-01-01T00:00:00.000Z",
  databases: [database],
  tables: tableNames.map((tableName) => ({
    metadata: {
      database,
      schemaName: "dbo",
      tableName,
      columns: [],
      indexes: [],
      estimatedRowCount: 0,
      sampleSize: 0,
    },
    semantic: {
      role: "unknown",
      granularity: "register",
      hasDirectUserLink: false,
      rationale: "",
      risks: [],
    },
    samples: [],
  })) as TableDiscoverySnapshot[],
});

const makeLogger = () => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});

describe("DiscoverFinancialDomainUseCase", () => {
  beforeEach(() => {});

  test("consolida snapshots de todas as fontes", async () => {
    const sourceA: SourceDomainDiscoveryPort = {
      inspectScope: async () =>
        makeSnapshot("FinancialControlDB", ["Card", "InvoiceItem"]),
    };
    const sourceB: SourceDomainDiscoveryPort = {
      inspectScope: async () =>
        makeSnapshot("AccountControlDB", ["Cards", "Accounts", "Invoices"]),
    };

    const useCase = new DiscoverFinancialDomainUseCase(
      [sourceA, sourceB],
      makeLogger(),
    );
    const snapshot = await useCase.execute();

    expect(snapshot.databases).toEqual([
      "FinancialControlDB",
      "AccountControlDB",
    ]);
    expect(snapshot.tables).toHaveLength(5);
    const tableNames = snapshot.tables.map((table) => table.metadata.tableName);
    expect(tableNames).toContain("Card");
    expect(tableNames).toContain("InvoiceItem");
    expect(tableNames).toContain("Cards");
    expect(tableNames).toContain("Accounts");
    expect(tableNames).toContain("Invoices");
  });

  test("aceita uma única fonte", async () => {
    const source: SourceDomainDiscoveryPort = {
      inspectScope: async () =>
        makeSnapshot("FinancialControlDB", ["TransactionItem"]),
    };

    const useCase = new DiscoverFinancialDomainUseCase([source], makeLogger());
    const snapshot = await useCase.execute();

    expect(snapshot.databases).toEqual(["FinancialControlDB"]);
    expect(snapshot.tables).toHaveLength(1);
  });

  test("mantém descoberta read-only nas fontes", async () => {
    let inspected = false;
    const source: SourceDomainDiscoveryPort = {
      inspectScope: async () => {
        inspected = true;
        return makeSnapshot("AccountControlDB", ["Accounts"]);
      },
    };

    const useCase = new DiscoverFinancialDomainUseCase([source], makeLogger());
    await useCase.execute();

    expect(inspected).toBe(true);
  });
});

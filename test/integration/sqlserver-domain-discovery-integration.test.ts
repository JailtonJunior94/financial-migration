import { describe, expect, test } from "bun:test";
import { SqlServerClient } from "../../src/adapters/sqlserver/sqlserver-client.ts";
import { SqlServerDomainDiscoveryAdapter } from "../../src/adapters/sqlserver/sqlserver-domain-discovery.ts";
import { DiscoverFinancialDomainUseCase } from "../../src/application/use-cases/discover-financial-domain.ts";
import { DISCOVERY_SCOPE } from "../../src/domain/discovery/scope.ts";
import type { LegacyDatabase } from "../../src/domain/discovery/types.ts";

type QueryResult<T> = {
  recordset: T[];
};

type FakeRequest = {
  input: (_name: string, _value: unknown) => FakeRequest;
  query: <T>() => Promise<QueryResult<T>>;
};

type FakePool = {
  request: () => FakeRequest;
  close: () => Promise<void>;
};

const createFakeClient = (
  database: LegacyDatabase,
  responses: QueryResult<Record<string, unknown>>[],
): SqlServerClient => {
  let callIndex = 0;

  const buildRequest = (): FakeRequest => {
    const self: FakeRequest = {
      input: () => self,
      query: async <T>() => {
        if (callIndex >= responses.length) {
          throw new Error(`Unexpected query call #${callIndex}`);
        }
        return responses[callIndex++] as QueryResult<T>;
      },
    };
    return self;
  };

  const fakePool: FakePool = {
    request: buildRequest,
    close: async () => {},
  };

  const client = new SqlServerClient({
    source: database === "AccountControlDB" ? "source-b" : "source-a",
    host: "localhost",
    port: 1433,
    database,
    user: "user",
    password: "password",
    encrypt: false,
    trustServerCertificate: true,
  });

  client.withPool = async <T>(
    callback: (pool: never) => Promise<T>,
  ): Promise<T> => {
    try {
      return await callback(fakePool as never);
    } finally {
      await fakePool.close();
    }
  };

  return client;
};

const buildResponsesForDatabase = (
  database: LegacyDatabase,
): QueryResult<Record<string, unknown>>[] => {
  const responses: QueryResult<Record<string, unknown>>[] = [];

  for (const tableName of DISCOVERY_SCOPE[database]) {
    responses.push({
      recordset: [
        {
          schema_name: "dbo",
          table_name: tableName,
          column_name: "id",
          data_type: "int",
          is_nullable: "NO",
          is_primary_key: 1,
          is_indexed: 1,
          fk_table_name: null,
          fk_column_name: null,
        },
        {
          schema_name: "dbo",
          table_name: tableName,
          column_name: "amount",
          data_type: "decimal",
          is_nullable: "YES",
          is_primary_key: 0,
          is_indexed: 0,
          fk_table_name: null,
          fk_column_name: null,
        },
      ],
    });
    responses.push({
      recordset: [
        {
          index_name: `PK_${tableName}`,
          column_name: "id",
          is_unique: 1,
          is_primary_key: 1,
        },
      ],
    });
    responses.push({ recordset: [{ row_count: 100 }] });
    responses.push({
      recordset: [
        {
          id: 1,
          amount: 99.99,
        },
      ],
    });
  }

  return responses;
};

describe("domain discovery integration", () => {
  test("pipeline de descoberta cobre schema, índices, cardinalidade e amostras", async () => {
    const accountClient = createFakeClient(
      "AccountControlDB",
      buildResponsesForDatabase("AccountControlDB"),
    );
    const financialClient = createFakeClient(
      "FinancialControlDB",
      buildResponsesForDatabase("FinancialControlDB"),
    );

    const useCase = new DiscoverFinancialDomainUseCase(
      [
        new SqlServerDomainDiscoveryAdapter(accountClient, "AccountControlDB"),
        new SqlServerDomainDiscoveryAdapter(
          financialClient,
          "FinancialControlDB",
        ),
      ],
      {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    );

    const snapshot = await useCase.execute();

    expect(snapshot.databases).toContain("AccountControlDB");
    expect(snapshot.databases).toContain("FinancialControlDB");
    expect(snapshot.tables).toHaveLength(10);

    for (const table of snapshot.tables) {
      expect(table.metadata.columns.length).toBeGreaterThan(0);
      expect(table.metadata.indexes.length).toBeGreaterThan(0);
      expect(table.metadata.estimatedRowCount).toBe(100);
      expect(table.samples.length).toBeGreaterThan(0);
      expect(table.semantic.rationale.length).toBeGreaterThan(0);
    }
  });

  test("snapshot inclui metadados de FK quando presentes", async () => {
    const responses: QueryResult<Record<string, unknown>>[] = [];

    for (const tableName of DISCOVERY_SCOPE.FinancialControlDB) {
      if (tableName === "InvoiceItem") {
        responses.push({
          recordset: [
            {
              schema_name: "dbo",
              table_name: "InvoiceItem",
              column_name: "id",
              data_type: "int",
              is_nullable: "NO",
              is_primary_key: 1,
              is_indexed: 1,
              fk_table_name: null,
              fk_column_name: null,
            },
            {
              schema_name: "dbo",
              table_name: "InvoiceItem",
              column_name: "invoice_id",
              data_type: "int",
              is_nullable: "NO",
              is_primary_key: 0,
              is_indexed: 1,
              fk_table_name: "Invoice",
              fk_column_name: "id",
            },
          ],
        });
        responses.push({
          recordset: [
            {
              index_name: "PK_InvoiceItem",
              column_name: "id",
              is_unique: 1,
              is_primary_key: 1,
            },
            {
              index_name: "IX_InvoiceItem_InvoiceId",
              column_name: "invoice_id",
              is_unique: 0,
              is_primary_key: 0,
            },
          ],
        });
        responses.push({ recordset: [{ row_count: 50 }] });
        responses.push({ recordset: [{ id: 1, invoice_id: 10 }] });
        continue;
      }

      responses.push({
        recordset: [
          {
            schema_name: "dbo",
            table_name: tableName,
            column_name: "id",
            data_type: "int",
            is_nullable: "NO",
            is_primary_key: 1,
            is_indexed: 1,
            fk_table_name: null,
            fk_column_name: null,
          },
        ],
      });
      responses.push({
        recordset: [
          {
            index_name: `PK_${tableName}`,
            column_name: "id",
            is_unique: 1,
            is_primary_key: 1,
          },
        ],
      });
      responses.push({ recordset: [{ row_count: 0 }] });
      responses.push({ recordset: [] });
    }

    const client = createFakeClient("FinancialControlDB", responses);
    const adapter = new SqlServerDomainDiscoveryAdapter(
      client,
      "FinancialControlDB",
    );
    const snapshot = await adapter.inspectScope();

    const invoiceItem = snapshot.tables.find(
      (table) => table.metadata.tableName === "InvoiceItem",
    );
    expect(invoiceItem).toBeDefined();
    if (!invoiceItem) return;

    const invoiceIdColumn = invoiceItem.metadata.columns.find(
      (column) => column.columnName === "invoice_id",
    );
    expect(invoiceIdColumn).toBeDefined();
    if (!invoiceIdColumn) return;
    expect(invoiceIdColumn.foreignKeyTarget).toEqual({
      table: "Invoice",
      column: "id",
    });
    expect(invoiceItem.metadata.indexes).toHaveLength(2);
  });
});

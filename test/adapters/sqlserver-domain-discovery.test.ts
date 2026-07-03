import { beforeEach, describe, expect, test } from "bun:test";
import { SqlServerClient } from "../../src/adapters/sqlserver/sqlserver-client.ts";
import { SqlServerDomainDiscoveryAdapter } from "../../src/adapters/sqlserver/sqlserver-domain-discovery.ts";
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

describe("SqlServerDomainDiscoveryAdapter (unit)", () => {
  beforeEach(() => {});

  test("descobre metadados, índices, cardinalidade e amostras sanitizadas", async () => {
    const cardResponses: QueryResult<Record<string, unknown>>[] = [
      {
        recordset: [
          {
            schema_name: "dbo",
            table_name: "Card",
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
            table_name: "Card",
            column_name: "name",
            data_type: "nvarchar",
            is_nullable: "YES",
            is_primary_key: 0,
            is_indexed: 0,
            fk_table_name: null,
            fk_column_name: null,
          },
          {
            schema_name: "dbo",
            table_name: "Card",
            column_name: "card_number",
            data_type: "nvarchar",
            is_nullable: "YES",
            is_primary_key: 0,
            is_indexed: 1,
            fk_table_name: null,
            fk_column_name: null,
          },
        ],
      },
      {
        recordset: [
          {
            index_name: "PK_Card",
            column_name: "id",
            is_unique: 1,
            is_primary_key: 1,
          },
          {
            index_name: "IX_Card_Number",
            column_name: "card_number",
            is_unique: 0,
            is_primary_key: 0,
          },
        ],
      },
      { recordset: [{ row_count: 5 }] },
      {
        recordset: [
          {
            id: 1,
            name: "Nubank",
            card_number: "4111111111111111",
          },
        ],
      },
    ];

    const fullResponses: QueryResult<Record<string, unknown>>[] = [];
    for (const tableName of DISCOVERY_SCOPE.FinancialControlDB) {
      if (tableName === "Card") {
        fullResponses.push(...cardResponses);
        continue;
      }

      fullResponses.push({
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
      fullResponses.push({
        recordset: [
          {
            index_name: `PK_${tableName}`,
            column_name: "id",
            is_unique: 1,
            is_primary_key: 1,
          },
        ],
      });
      fullResponses.push({ recordset: [{ row_count: 0 }] });
      fullResponses.push({ recordset: [] });
    }

    const client = createFakeClient("FinancialControlDB", fullResponses);
    const adapter = new SqlServerDomainDiscoveryAdapter(
      client,
      "FinancialControlDB",
      { sampleSize: 1 },
    );

    const snapshot = await adapter.inspectScope();

    expect(snapshot.databases).toEqual(["FinancialControlDB"]);
    expect(snapshot.tables).toHaveLength(7);

    const cardTable = snapshot.tables.find(
      (table) => table.metadata.tableName === "Card",
    );
    expect(cardTable).toBeDefined();
    if (!cardTable) return;
    expect(cardTable.metadata.columns).toHaveLength(3);
    expect(cardTable.metadata.indexes).toHaveLength(2);
    expect(cardTable.metadata.estimatedRowCount).toBe(5);
    expect(cardTable.samples).toHaveLength(1);
    const [firstSample] = cardTable.samples;
    expect(firstSample).toBeDefined();
    if (!firstSample) return;
    expect(firstSample.fields.card_number).toBe("****1111");
    expect(cardTable.semantic.role).toBe("card_register");
  });

  test("restringe a descoberta às tabelas do escopo do PRD", async () => {
    const responses: QueryResult<Record<string, unknown>>[] = [];
    for (const tableName of DISCOVERY_SCOPE.AccountControlDB) {
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

    const client = createFakeClient("AccountControlDB", responses);
    const adapter = new SqlServerDomainDiscoveryAdapter(
      client,
      "AccountControlDB",
    );
    const snapshot = await adapter.inspectScope();

    expect(snapshot.tables.map((table) => table.metadata.tableName)).toEqual([
      "Cards",
      "Accounts",
      "Invoices",
    ]);
  });
});

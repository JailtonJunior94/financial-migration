import type { SourceDomainDiscoveryPort } from "../../application/ports/source-domain-discovery-port.ts";
import { ApplicationError } from "../../domain/common/errors.ts";
import { sanitizeSample } from "../../domain/discovery/sanitize-sample.ts";
import {
  DISCOVERY_SCOPE,
  expectedTableCount,
} from "../../domain/discovery/scope.ts";
import { resolveSemanticMetadata } from "../../domain/discovery/table-role-matrix.ts";
import type {
  FinancialDiscoverySnapshot,
  LegacyDatabase,
  SanitizedSample,
  TableColumnMetadata,
  TableDiscoveryMetadata,
  TableDiscoverySnapshot,
  TableIndexMetadata,
} from "../../domain/discovery/types.ts";
import type { SqlServerClient } from "./sqlserver-client.ts";

type ColumnRow = {
  schema_name: string;
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
  is_primary_key: number;
  is_indexed: number;
  fk_table_name: string | null;
  fk_column_name: string | null;
};

type IndexRow = {
  index_name: string;
  column_name: string;
  is_unique: number;
  is_primary_key: number;
};

type CountRow = {
  row_count: number;
};

const DEFAULT_SCHEMA = "dbo";
const DEFAULT_SAMPLE_SIZE = 20;

export class SqlServerDomainDiscoveryAdapter
  implements SourceDomainDiscoveryPort
{
  constructor(
    private readonly client: SqlServerClient,
    private readonly database: LegacyDatabase,
    private readonly options: { schemaName?: string; sampleSize?: number } = {},
  ) {}

  async inspectScope(): Promise<FinancialDiscoverySnapshot> {
    const schemaName = this.options.schemaName ?? DEFAULT_SCHEMA;
    const sampleSize = this.options.sampleSize ?? DEFAULT_SAMPLE_SIZE;
    const tables: TableDiscoverySnapshot[] = [];

    return this.client.withPool(async (pool) => {
      for (const tableName of DISCOVERY_SCOPE[this.database]) {
        const metadata = await this.inspectTableMetadata(
          pool,
          schemaName,
          tableName,
        );
        const samples = await this.readSamples(
          pool,
          schemaName,
          tableName,
          metadata.columns,
          sampleSize,
        );

        tables.push({
          metadata,
          semantic: resolveSemanticMetadata(this.database, tableName),
          samples,
        });
      }

      return {
        discoveredAt: new Date().toISOString(),
        databases: [this.database],
        tables,
      };
    });
  }

  private async inspectTableMetadata(
    pool: import("mssql").ConnectionPool,
    schemaName: string,
    tableName: string,
  ): Promise<TableDiscoveryMetadata> {
    const columns = await this.readColumns(pool, schemaName, tableName);
    const indexes = await this.readIndexes(pool, schemaName, tableName);
    const estimatedRowCount = await this.readRowCount(
      pool,
      schemaName,
      tableName,
    );

    return {
      database: this.database,
      schemaName,
      tableName,
      columns,
      indexes,
      estimatedRowCount,
      sampleSize: this.options.sampleSize ?? DEFAULT_SAMPLE_SIZE,
    };
  }

  private async readColumns(
    pool: import("mssql").ConnectionPool,
    schemaName: string,
    tableName: string,
  ): Promise<readonly TableColumnMetadata[]> {
    const query = `
      SELECT
        s.name AS schema_name,
        t.name AS table_name,
        c.name AS column_name,
        ty.name AS data_type,
        CASE WHEN c.is_nullable = 1 THEN 'YES' ELSE 'NO' END AS is_nullable,
        CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key,
        CASE WHEN idx.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_indexed,
        fk_t.name AS fk_table_name,
        fk_c.name AS fk_column_name
      FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      JOIN sys.columns c ON c.object_id = t.object_id
      JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      LEFT JOIN (
        SELECT ic.object_id, ic.column_id
        FROM sys.indexes i
        JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        WHERE i.is_primary_key = 1
      ) pk ON pk.object_id = c.object_id AND pk.column_id = c.column_id
      LEFT JOIN (
        SELECT ic.object_id, ic.column_id
        FROM sys.indexes i
        JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        WHERE i.type > 0
      ) idx ON idx.object_id = c.object_id AND idx.column_id = c.column_id
      LEFT JOIN sys.foreign_key_columns fkc ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
      LEFT JOIN sys.tables fk_t ON fk_t.object_id = fkc.referenced_object_id
      LEFT JOIN sys.columns fk_c ON fk_c.object_id = fkc.referenced_object_id AND fk_c.column_id = fkc.referenced_column_id
      WHERE t.is_ms_shipped = 0
        AND s.name = @schemaName
        AND t.name = @tableName
      ORDER BY c.column_id;
    `;

    const result = await pool
      .request()
      .input("schemaName", schemaName)
      .input("tableName", tableName)
      .query<ColumnRow>(query);

    return result.recordset.map((row) => {
      const column: TableColumnMetadata = {
        columnName: row.column_name,
        dataType: row.data_type,
        isNullable: row.is_nullable === "YES",
        isPrimaryKey: row.is_primary_key === 1,
        isIndexed: row.is_indexed === 1,
      };

      if (row.fk_table_name && row.fk_column_name) {
        return {
          ...column,
          foreignKeyTarget: {
            table: row.fk_table_name,
            column: row.fk_column_name,
          },
        };
      }

      return column;
    });
  }

  private async readIndexes(
    pool: import("mssql").ConnectionPool,
    schemaName: string,
    tableName: string,
  ): Promise<readonly TableIndexMetadata[]> {
    const query = `
      SELECT
        i.name AS index_name,
        c.name AS column_name,
        i.is_unique AS is_unique,
        i.is_primary_key AS is_primary_key
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID(@qualifiedTable)
        AND i.type > 0
      ORDER BY i.index_id, ic.index_column_id;
    `;

    const qualifiedTable = `[${schemaName}].[${tableName}]`;
    const result = await pool
      .request()
      .input("qualifiedTable", qualifiedTable)
      .query<IndexRow>(query);

    const indexMap = new Map<string, TableIndexMetadata>();

    for (const row of result.recordset) {
      const existing = indexMap.get(row.index_name);
      if (existing) {
        indexMap.set(row.index_name, {
          ...existing,
          columns: [...existing.columns, row.column_name],
        });
        continue;
      }

      indexMap.set(row.index_name, {
        indexName: row.index_name,
        columns: [row.column_name],
        isUnique: row.is_unique === 1,
        isPrimaryKey: row.is_primary_key === 1,
      });
    }

    return [...indexMap.values()];
  }

  private async readRowCount(
    pool: import("mssql").ConnectionPool,
    schemaName: string,
    tableName: string,
  ): Promise<number> {
    const query = `SELECT COUNT(*) AS row_count FROM [${schemaName}].[${tableName}];`;
    const result = await pool.request().query<CountRow>(query);
    const firstRow = result.recordset[0];

    if (!firstRow) {
      throw new ApplicationError(
        "SOURCE_READ_FAILURE",
        `Contagem de linhas retornou resultado vazio para ${schemaName}.${tableName}.`,
        { database: this.database, schemaName, tableName },
      );
    }

    return firstRow.row_count;
  }

  private async readSamples(
    pool: import("mssql").ConnectionPool,
    schemaName: string,
    tableName: string,
    columns: readonly TableColumnMetadata[],
    sampleSize: number,
  ): Promise<readonly SanitizedSample[]> {
    const primaryKeyColumn = columns.find((column) => column.isPrimaryKey);
    const orderColumn = primaryKeyColumn?.columnName ?? columns[0]?.columnName;

    if (!orderColumn) {
      throw new ApplicationError(
        "SOURCE_READ_FAILURE",
        `Tabela ${schemaName}.${tableName} não possui colunas identificáveis para amostragem.`,
        { database: this.database, schemaName, tableName },
      );
    }

    const query = `
      SELECT TOP (@sampleSize) *
      FROM [${schemaName}].[${tableName}]
      ORDER BY [${orderColumn}] ASC;
    `;

    const result = await pool
      .request()
      .input("sampleSize", sampleSize)
      .query<Record<string, unknown>>(query);

    return result.recordset.map((row) => {
      const primaryKeyValue = primaryKeyColumn
        ? String(row[primaryKeyColumn.columnName] ?? "unknown")
        : String(row[orderColumn] ?? "unknown");

      return sanitizeSample(this.database, tableName, primaryKeyValue, row);
    });
  }
}

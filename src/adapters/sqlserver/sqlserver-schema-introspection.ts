import type { SchemaIntrospectionPort } from "../../application/ports/schema-introspection-port.ts";
import type {
  ColumnMetadata,
  SchemaInspection,
  TableMetadata,
} from "../../domain/schema/types.ts";
import type { SqlServerClient } from "./sqlserver-client.ts";

type ColumnRow = {
  schema_name: string;
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
  is_primary_key: number;
  fk_schema_name: string | null;
  fk_table_name: string | null;
  fk_column_name: string | null;
};

const introspectionQuery = `
SELECT
  s.name AS schema_name,
  t.name AS table_name,
  c.name AS column_name,
  ty.name AS data_type,
  CASE WHEN c.is_nullable = 1 THEN 'YES' ELSE 'NO' END AS is_nullable,
  CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key,
  fk_s.name AS fk_schema_name,
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
LEFT JOIN sys.foreign_key_columns fkc ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
LEFT JOIN sys.tables fk_t ON fk_t.object_id = fkc.referenced_object_id
LEFT JOIN sys.schemas fk_s ON fk_s.schema_id = fk_t.schema_id
LEFT JOIN sys.columns fk_c ON fk_c.object_id = fkc.referenced_object_id AND fk_c.column_id = fkc.referenced_column_id
WHERE t.is_ms_shipped = 0
ORDER BY s.name, t.name, c.column_id;
`;

export class SqlServerSchemaIntrospectionAdapter
  implements SchemaIntrospectionPort
{
  constructor(private readonly client: SqlServerClient) {}

  async inspect(): Promise<SchemaInspection> {
    return this.client.withPool(async (pool) => {
      const result = await pool.request().query<ColumnRow>(introspectionQuery);
      const tables = new Map<string, TableMetadata>();

      for (const row of result.recordset) {
        const key = `${row.schema_name}.${row.table_name}`;
        const column: ColumnMetadata = {
          schemaName: row.schema_name,
          tableName: row.table_name,
          columnName: row.column_name,
          dataType: row.data_type,
          isNullable: row.is_nullable === "YES",
          isPrimaryKey: row.is_primary_key === 1,
        };
        if (row.fk_schema_name && row.fk_table_name && row.fk_column_name) {
          column.foreignKeyTarget = {
            schemaName: row.fk_schema_name,
            tableName: row.fk_table_name,
            columnName: row.fk_column_name,
          };
        }

        const existing = tables.get(key);
        if (existing) {
          existing.columns.push(column);
          continue;
        }

        tables.set(key, {
          source: this.client.config.source,
          schemaName: row.schema_name,
          tableName: row.table_name,
          columns: [column],
        });
      }

      return {
        source: this.client.config.source,
        tables: [...tables.values()],
        inspectedAt: new Date().toISOString(),
      };
    });
  }
}

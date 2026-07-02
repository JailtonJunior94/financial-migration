import type {
  SourceRecordBatch,
  SourceRecordReaderPort,
} from "../../application/ports/source-record-reader-port.ts";
import type { PilotEntitySelection } from "../../domain/schema/types.ts";
import type { SourceRecord, SyncCursor } from "../../domain/sync/types.ts";
import type { SqlServerClient } from "./sqlserver-client.ts";

type TableRow = Record<string, unknown>;

export class SqlServerSourceRecordReaderAdapter
  implements SourceRecordReaderPort
{
  constructor(
    private readonly client: SqlServerClient,
    private readonly batchSize = 100,
  ) {}

  async read(
    selection: PilotEntitySelection,
    cursor?: SyncCursor,
  ): Promise<SourceRecordBatch> {
    return this.client.withPool(async (pool) => {
      const quotedTable = `[${selection.schemaName}].[${selection.tableName}]`;
      const primaryKeyColumn = "id";
      const request = pool.request();
      request.input("batchSize", this.batchSize);
      request.input("lastPrimaryKey", cursor?.lastPrimaryKey ?? "");

      const query = `
        SELECT TOP (@batchSize) *
        FROM ${quotedTable}
        WHERE (@lastPrimaryKey = '' OR CAST([${primaryKeyColumn}] AS NVARCHAR(255)) > @lastPrimaryKey)
        ORDER BY [${primaryKeyColumn}] ASC;
      `;

      const result = await request.query<TableRow>(query);
      const records: SourceRecord[] = result.recordset.map((row: TableRow) => ({
        source: selection.source,
        entity: `${selection.schemaName}.${selection.tableName}`,
        primaryKey: String(row[primaryKeyColumn]),
        capturedAt: new Date().toISOString(),
        fields: row,
      }));

      const lastRecord = records.at(-1);
      const nextCursor =
        records.length === this.batchSize && lastRecord
          ? {
              entity: `${selection.schemaName}.${selection.tableName}`,
              lastPrimaryKey: lastRecord.primaryKey,
            }
          : undefined;

      return {
        records,
        nextCursor,
      };
    });
  }
}

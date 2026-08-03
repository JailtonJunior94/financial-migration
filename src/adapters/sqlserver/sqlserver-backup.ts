import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type sql from "mssql";
import {
  SqlServerClient,
  type SqlServerConnectionConfig,
} from "./sqlserver-client.ts";

export type BackupTarget = {
  key: string;
  connection: SqlServerConnectionConfig;
};

type TableRow = {
  object_id: number;
  schema_name: string;
  table_name: string;
};

type SchemaRow = {
  schema_name: string;
};

type ColumnRow = {
  object_id: number;
  column_id: number;
  column_name: string;
  data_type: string;
  max_length: number;
  precision: number;
  scale: number;
  is_nullable: boolean;
  is_identity: boolean;
  is_computed: boolean;
  collation_name: string | null;
  default_definition: string | null;
  identity_seed: string | null;
  identity_increment: string | null;
  computed_definition: string | null;
};

type PrimaryKeyRow = {
  object_id: number;
  constraint_name: string;
  index_type_desc: string;
  key_ordinal: number;
  column_name: string;
};

type ForeignKeyRow = {
  object_id: number;
  constraint_name: string;
  referenced_schema_name: string;
  referenced_table_name: string;
  delete_action: string;
  update_action: string;
  is_not_trusted: boolean;
  is_disabled: boolean;
  constraint_column_id: number;
  parent_column_name: string;
  referenced_column_name: string;
};

type CheckConstraintRow = {
  object_id: number;
  constraint_name: string;
  definition: string;
  is_not_trusted: boolean;
  is_disabled: boolean;
};

type IndexRow = {
  object_id: number;
  index_name: string;
  is_unique: boolean;
  type_desc: string;
  has_filter: boolean;
  filter_definition: string | null;
  key_ordinal: number;
  is_descending_key: boolean;
  is_included_column: boolean;
  column_name: string;
};

type DefaultBackupPathRow = {
  default_backup_path: string | null;
};

type ColumnDefinition = {
  columnId: number;
  columnName: string;
  dataType: string;
  maxLength: number;
  precision: number;
  scale: number;
  isNullable: boolean;
  isIdentity: boolean;
  isComputed: boolean;
  collationName: string | null;
  defaultDefinition: string | null;
  identitySeed: string | null;
  identityIncrement: string | null;
  computedDefinition: string | null;
};

type PrimaryKeyDefinition = {
  constraintName: string;
  indexTypeDesc: string;
  columns: string[];
};

type ForeignKeyDefinition = {
  constraintName: string;
  referencedSchemaName: string;
  referencedTableName: string;
  deleteAction: string;
  updateAction: string;
  isNotTrusted: boolean;
  isDisabled: boolean;
  mappings: { parentColumnName: string; referencedColumnName: string }[];
};

type CheckConstraintDefinition = {
  constraintName: string;
  definition: string;
  isNotTrusted: boolean;
  isDisabled: boolean;
};

type IndexDefinition = {
  indexName: string;
  isUnique: boolean;
  typeDesc: string;
  hasFilter: boolean;
  filterDefinition: string | null;
  keyColumns: { columnName: string; isDescending: boolean }[];
  includedColumns: string[];
};

export type TableDefinition = {
  objectId: number;
  schemaName: string;
  tableName: string;
  columns: ColumnDefinition[];
  primaryKey: PrimaryKeyDefinition | null;
  foreignKeys: ForeignKeyDefinition[];
  checkConstraints: CheckConstraintDefinition[];
  indexes: IndexDefinition[];
};

export type FileChecksum = {
  path: string;
  sha256: string;
  bytes: number;
};

export type TableExportSummary = {
  schemaName: string;
  tableName: string;
  rowCount: number;
  dataFile: string;
};

export type PhysicalBackupSummary = {
  remotePath: string;
  success: boolean;
  verified: boolean;
  downloadedLocally: boolean;
  errorMessage?: string;
};

export type BackupSummary = {
  key: string;
  database: string;
  host: string;
  startedAt: string;
  completedAt: string;
  outputDir: string;
  physical: PhysicalBackupSummary;
  logical: {
    schemas: string[];
    tables: TableExportSummary[];
    fileChecksums: FileChecksum[];
  };
};

export type BackupRunSummary = {
  startedAt: string;
  completedAt: string;
  outputDir: string;
  databases: BackupSummary[];
};

type QueryRunner = Pick<sql.ConnectionPool, "request">;

async function queryRows<T extends Record<string, unknown>>(
  pool: QueryRunner,
  statement: string,
): Promise<T[]> {
  const result = await pool.request().query<T>(statement);
  return result.recordset;
}

export function quoteIdentifier(value: string): string {
  return `[${value.replaceAll("]", "]]")}]`;
}

function quoteQualifiedName(schemaName: string, objectName: string): string {
  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(objectName)}`;
}

function quoteUnicodeLiteral(value: string): string {
  return `N'${value.replaceAll("'", "''")}'`;
}

function normalizePathSegment(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]+/g, "-").replaceAll(/-+/g, "-");
}

function toWindowsPath(...segments: string[]): string {
  return segments.join("\\");
}

function formatTimestampForFileName(timestamp: Date): string {
  return timestamp.toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function mapActionClause(
  action: string,
  prefix: "ON DELETE" | "ON UPDATE",
): string {
  switch (action) {
    case "CASCADE":
      return ` ${prefix} CASCADE`;
    case "SET_NULL":
      return ` ${prefix} SET NULL`;
    case "SET_DEFAULT":
      return ` ${prefix} SET DEFAULT`;
    default:
      return "";
  }
}

function normalizeStringValue(value: string): string {
  return value.replaceAll("\r\n", "\n");
}

function formatDateValue(value: Date): string {
  return value.toISOString().replace("T", " ").replace("Z", "");
}

export function renderSqlLiteral(
  value: unknown,
  column: Pick<ColumnDefinition, "dataType">,
): string {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "string") {
    if (column.dataType === "uniqueidentifier") {
      return `'${value.replaceAll("'", "''")}'`;
    }

    return quoteUnicodeLiteral(normalizeStringValue(value));
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Numero invalido para exportacao SQL: ${value}`);
    }

    return `${value}`;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  if (value instanceof Date) {
    return quoteUnicodeLiteral(formatDateValue(value));
  }

  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
    return `0x${buffer.toString("hex").toUpperCase()}`;
  }

  return quoteUnicodeLiteral(JSON.stringify(value));
}

function formatDataType(column: ColumnDefinition): string {
  const typeName = column.dataType.toLowerCase();

  if (column.isComputed && column.computedDefinition) {
    return `AS ${column.computedDefinition}`;
  }

  switch (typeName) {
    case "nvarchar":
    case "nchar":
      return `${typeName}(${column.maxLength === -1 ? "MAX" : column.maxLength / 2})`;
    case "varchar":
    case "char":
    case "varbinary":
    case "binary":
      return `${typeName}(${column.maxLength === -1 ? "MAX" : column.maxLength})`;
    case "decimal":
    case "numeric":
      return `${typeName}(${column.precision}, ${column.scale})`;
    case "datetime2":
    case "datetimeoffset":
    case "time":
      return `${typeName}(${column.scale})`;
    default:
      return typeName;
  }
}

function formatColumnDefinition(column: ColumnDefinition): string {
  if (column.isComputed && column.computedDefinition) {
    return `  ${quoteIdentifier(column.columnName)} ${formatDataType(column)}`;
  }

  const parts = [
    `  ${quoteIdentifier(column.columnName)} ${formatDataType(column)}`,
  ];

  if (column.collationName) {
    parts.push(`COLLATE ${column.collationName}`);
  }

  if (column.isIdentity) {
    const seed = column.identitySeed ?? "1";
    const increment = column.identityIncrement ?? "1";
    parts.push(`IDENTITY(${seed},${increment})`);
  }

  if (column.defaultDefinition) {
    parts.push(`DEFAULT ${column.defaultDefinition}`);
  }

  parts.push(column.isNullable ? "NULL" : "NOT NULL");
  return parts.join(" ");
}

export function buildCreateTableStatement(table: TableDefinition): string {
  const lines = table.columns.map((column) => formatColumnDefinition(column));

  if (table.primaryKey) {
    const clustered =
      table.primaryKey.indexTypeDesc === "CLUSTERED"
        ? "CLUSTERED"
        : "NONCLUSTERED";
    lines.push(
      `  CONSTRAINT ${quoteIdentifier(table.primaryKey.constraintName)} PRIMARY KEY ${clustered} (${table.primaryKey.columns
        .map((columnName) => quoteIdentifier(columnName))
        .join(", ")})`,
    );
  }

  return [
    `IF OBJECT_ID(${quoteUnicodeLiteral(
      `${table.schemaName}.${table.tableName}`,
    )}, 'U') IS NULL`,
    "BEGIN",
    `CREATE TABLE ${quoteQualifiedName(table.schemaName, table.tableName)} (`,
    lines.join(",\n"),
    ");",
    "END;",
  ].join("\n");
}

function buildCheckConstraintStatement(
  table: TableDefinition,
  constraint: CheckConstraintDefinition,
): string {
  const trustClause = constraint.isNotTrusted ? " WITH NOCHECK" : " WITH CHECK";
  const enableClause = constraint.isDisabled ? " NOCHECK" : " CHECK";
  return [
    `ALTER TABLE ${quoteQualifiedName(table.schemaName, table.tableName)}${trustClause} ADD CONSTRAINT ${quoteIdentifier(
      constraint.constraintName,
    )} CHECK ${constraint.definition};`,
    `ALTER TABLE ${quoteQualifiedName(table.schemaName, table.tableName)}${enableClause} CONSTRAINT ${quoteIdentifier(
      constraint.constraintName,
    )};`,
  ].join("\n");
}

function buildForeignKeyStatement(
  table: TableDefinition,
  foreignKey: ForeignKeyDefinition,
): string {
  const parentColumns = foreignKey.mappings
    .map((mapping) => quoteIdentifier(mapping.parentColumnName))
    .join(", ");
  const referencedColumns = foreignKey.mappings
    .map((mapping) => quoteIdentifier(mapping.referencedColumnName))
    .join(", ");
  const trustClause = foreignKey.isNotTrusted ? " WITH NOCHECK" : " WITH CHECK";
  const enableClause = foreignKey.isDisabled ? " NOCHECK" : " CHECK";

  return [
    `ALTER TABLE ${quoteQualifiedName(table.schemaName, table.tableName)}${trustClause} ADD CONSTRAINT ${quoteIdentifier(
      foreignKey.constraintName,
    )} FOREIGN KEY (${parentColumns}) REFERENCES ${quoteQualifiedName(
      foreignKey.referencedSchemaName,
      foreignKey.referencedTableName,
    )} (${referencedColumns})${mapActionClause(
      foreignKey.deleteAction,
      "ON DELETE",
    )}${mapActionClause(foreignKey.updateAction, "ON UPDATE")};`,
    `ALTER TABLE ${quoteQualifiedName(table.schemaName, table.tableName)}${enableClause} CONSTRAINT ${quoteIdentifier(
      foreignKey.constraintName,
    )};`,
  ].join("\n");
}

function buildIndexStatement(
  table: TableDefinition,
  index: IndexDefinition,
): string {
  const uniqueClause = index.isUnique ? "UNIQUE " : "";
  const indexType =
    index.typeDesc === "CLUSTERED" || index.typeDesc === "NONCLUSTERED"
      ? index.typeDesc
      : "NONCLUSTERED";
  const keyColumns = index.keyColumns
    .map(
      (column) =>
        `${quoteIdentifier(column.columnName)} ${column.isDescending ? "DESC" : "ASC"}`,
    )
    .join(", ");
  const includeClause =
    index.includedColumns.length > 0
      ? ` INCLUDE (${index.includedColumns
          .map((columnName) => quoteIdentifier(columnName))
          .join(", ")})`
      : "";
  const filterClause =
    index.hasFilter && index.filterDefinition
      ? ` WHERE ${index.filterDefinition}`
      : "";

  return `CREATE ${uniqueClause}${indexType} INDEX ${quoteIdentifier(
    index.indexName,
  )} ON ${quoteQualifiedName(table.schemaName, table.tableName)} (${keyColumns})${includeClause}${filterClause};`;
}

function buildRestoreScript(tableFiles: string[]): string {
  return [
    ":on error exit",
    "SET NOCOUNT ON;",
    "BEGIN TRANSACTION;",
    ":r .\\schema-pre-data.sql",
    ...tableFiles.map((file) => `:r .\\data\\${file}`),
    ":r .\\schema-post-data.sql",
    "COMMIT TRANSACTION;",
  ].join("\n");
}

function buildPortableRestoreScript(
  schemaPreDataSql: string,
  tableDataSql: string[],
  schemaPostDataSql: string,
): string {
  return [
    "SET NOCOUNT ON;",
    "BEGIN TRANSACTION;",
    schemaPreDataSql.trim(),
    ...tableDataSql.map((content) => content.trim()),
    schemaPostDataSql.trim(),
    "COMMIT TRANSACTION;",
  ]
    .filter((chunk) => chunk.length > 0)
    .join("\n\n");
}

async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function computeFileChecksum(path: string): Promise<FileChecksum> {
  const content = await readFile(path);
  return {
    path,
    sha256: createHash("sha256").update(content).digest("hex"),
    bytes: content.byteLength,
  };
}

async function writeTextFile(path: string, content: string): Promise<void> {
  await ensureDirectory(dirname(path));
  await writeFile(path, content, "utf8");
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function getSchemas(pool: QueryRunner): Promise<string[]> {
  const rows = await queryRows<SchemaRow>(
    pool,
    `
      SELECT DISTINCT s.name AS schema_name
      FROM sys.tables t
      INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
      WHERE t.is_ms_shipped = 0
      ORDER BY s.name;
    `,
  );
  return rows.map((row) => row.schema_name);
}

async function getTables(pool: QueryRunner): Promise<TableRow[]> {
  return queryRows<TableRow>(
    pool,
    `
      SELECT
        t.object_id,
        s.name AS schema_name,
        t.name AS table_name
      FROM sys.tables t
      INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
      WHERE t.is_ms_shipped = 0
      ORDER BY s.name, t.name;
    `,
  );
}

async function getColumns(pool: QueryRunner): Promise<ColumnRow[]> {
  return queryRows<ColumnRow>(
    pool,
    `
      SELECT
        c.object_id,
        c.column_id,
        c.name AS column_name,
        ty.name AS data_type,
        c.max_length,
        c.precision,
        c.scale,
        c.is_nullable,
        c.is_identity,
        c.is_computed,
        c.collation_name,
        dc.definition AS default_definition,
        CONVERT(nvarchar(64), ic.seed_value) AS identity_seed,
        CONVERT(nvarchar(64), ic.increment_value) AS identity_increment,
        cc.definition AS computed_definition
      FROM sys.columns c
      INNER JOIN sys.tables t ON t.object_id = c.object_id
      INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      LEFT JOIN sys.default_constraints dc ON dc.object_id = c.default_object_id
      LEFT JOIN sys.identity_columns ic
        ON ic.object_id = c.object_id
       AND ic.column_id = c.column_id
      LEFT JOIN sys.computed_columns cc
        ON cc.object_id = c.object_id
       AND cc.column_id = c.column_id
      WHERE t.is_ms_shipped = 0
      ORDER BY c.object_id, c.column_id;
    `,
  );
}

async function getPrimaryKeys(pool: QueryRunner): Promise<PrimaryKeyRow[]> {
  return queryRows<PrimaryKeyRow>(
    pool,
    `
      SELECT
        kc.parent_object_id AS object_id,
        kc.name AS constraint_name,
        i.type_desc AS index_type_desc,
        ic.key_ordinal,
        c.name AS column_name
      FROM sys.key_constraints kc
      INNER JOIN sys.indexes i
        ON i.object_id = kc.parent_object_id
       AND i.index_id = kc.unique_index_id
      INNER JOIN sys.index_columns ic
        ON ic.object_id = i.object_id
       AND ic.index_id = i.index_id
      INNER JOIN sys.columns c
        ON c.object_id = ic.object_id
       AND c.column_id = ic.column_id
      WHERE kc.type = 'PK'
      ORDER BY kc.parent_object_id, ic.key_ordinal;
    `,
  );
}

async function getForeignKeys(pool: QueryRunner): Promise<ForeignKeyRow[]> {
  return queryRows<ForeignKeyRow>(
    pool,
    `
      SELECT
        fk.parent_object_id AS object_id,
        fk.name AS constraint_name,
        rs.name AS referenced_schema_name,
        rt.name AS referenced_table_name,
        fk.delete_referential_action_desc AS delete_action,
        fk.update_referential_action_desc AS update_action,
        fk.is_not_trusted,
        fk.is_disabled,
        fkc.constraint_column_id,
        pc.name AS parent_column_name,
        rc.name AS referenced_column_name
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc
        ON fkc.constraint_object_id = fk.object_id
      INNER JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
      INNER JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
      INNER JOIN sys.columns pc
        ON pc.object_id = fkc.parent_object_id
       AND pc.column_id = fkc.parent_column_id
      INNER JOIN sys.columns rc
        ON rc.object_id = fkc.referenced_object_id
       AND rc.column_id = fkc.referenced_column_id
      ORDER BY fk.parent_object_id, fk.name, fkc.constraint_column_id;
    `,
  );
}

async function getCheckConstraints(
  pool: QueryRunner,
): Promise<CheckConstraintRow[]> {
  return queryRows<CheckConstraintRow>(
    pool,
    `
      SELECT
        cc.parent_object_id AS object_id,
        cc.name AS constraint_name,
        cc.definition,
        cc.is_not_trusted,
        cc.is_disabled
      FROM sys.check_constraints cc
      INNER JOIN sys.tables t ON t.object_id = cc.parent_object_id
      WHERE t.is_ms_shipped = 0
      ORDER BY cc.parent_object_id, cc.name;
    `,
  );
}

async function getIndexes(pool: QueryRunner): Promise<IndexRow[]> {
  return queryRows<IndexRow>(
    pool,
    `
      SELECT
        i.object_id,
        i.name AS index_name,
        i.is_unique,
        i.type_desc,
        i.has_filter,
        i.filter_definition,
        ic.key_ordinal,
        ic.is_descending_key,
        ic.is_included_column,
        c.name AS column_name
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic
        ON ic.object_id = i.object_id
       AND ic.index_id = i.index_id
      INNER JOIN sys.columns c
        ON c.object_id = ic.object_id
       AND c.column_id = ic.column_id
      INNER JOIN sys.tables t ON t.object_id = i.object_id
      WHERE t.is_ms_shipped = 0
        AND i.is_primary_key = 0
        AND i.is_unique_constraint = 0
        AND i.is_hypothetical = 0
        AND i.name IS NOT NULL
        AND i.type_desc <> 'HEAP'
      ORDER BY i.object_id, i.name, ic.is_included_column, ic.key_ordinal, ic.index_column_id;
    `,
  );
}

function buildTableDefinitions(
  tables: TableRow[],
  columns: ColumnRow[],
  primaryKeys: PrimaryKeyRow[],
  foreignKeys: ForeignKeyRow[],
  checkConstraints: CheckConstraintRow[],
  indexes: IndexRow[],
): TableDefinition[] {
  return tables.map((table) => {
    const tableColumns = columns
      .filter((column) => column.object_id === table.object_id)
      .map<ColumnDefinition>((column) => ({
        columnId: column.column_id,
        columnName: column.column_name,
        dataType: column.data_type,
        maxLength: column.max_length,
        precision: column.precision,
        scale: column.scale,
        isNullable: column.is_nullable,
        isIdentity: column.is_identity,
        isComputed: column.is_computed,
        collationName: column.collation_name,
        defaultDefinition: column.default_definition,
        identitySeed: column.identity_seed,
        identityIncrement: column.identity_increment,
        computedDefinition: column.computed_definition,
      }));

    const tablePrimaryKeyRows = primaryKeys.filter(
      (primaryKey) => primaryKey.object_id === table.object_id,
    );
    const primaryKey =
      tablePrimaryKeyRows.length > 0
        ? {
            constraintName: tablePrimaryKeyRows[0]!.constraint_name,
            indexTypeDesc: tablePrimaryKeyRows[0]!.index_type_desc,
            columns: tablePrimaryKeyRows
              .sort((left, right) => left.key_ordinal - right.key_ordinal)
              .map((primaryKey) => primaryKey.column_name),
          }
        : null;

    const tableForeignKeys = Array.from(
      new Map(
        foreignKeys
          .filter((foreignKey) => foreignKey.object_id === table.object_id)
          .map((foreignKey) => [foreignKey.constraint_name, foreignKey]),
      ).values(),
    ).map<ForeignKeyDefinition>((foreignKey) => ({
      constraintName: foreignKey.constraint_name,
      referencedSchemaName: foreignKey.referenced_schema_name,
      referencedTableName: foreignKey.referenced_table_name,
      deleteAction: foreignKey.delete_action,
      updateAction: foreignKey.update_action,
      isNotTrusted: foreignKey.is_not_trusted,
      isDisabled: foreignKey.is_disabled,
      mappings: foreignKeys
        .filter(
          (candidate) =>
            candidate.object_id === table.object_id &&
            candidate.constraint_name === foreignKey.constraint_name,
        )
        .sort(
          (left, right) =>
            left.constraint_column_id - right.constraint_column_id,
        )
        .map((mapping) => ({
          parentColumnName: mapping.parent_column_name,
          referencedColumnName: mapping.referenced_column_name,
        })),
    }));

    const tableChecks = checkConstraints
      .filter((constraint) => constraint.object_id === table.object_id)
      .map<CheckConstraintDefinition>((constraint) => ({
        constraintName: constraint.constraint_name,
        definition: constraint.definition,
        isNotTrusted: constraint.is_not_trusted,
        isDisabled: constraint.is_disabled,
      }));

    const tableIndexes = Array.from(
      new Map(
        indexes
          .filter((index) => index.object_id === table.object_id)
          .map((index) => [index.index_name, index]),
      ).values(),
    ).map<IndexDefinition>((index) => ({
      indexName: index.index_name,
      isUnique: index.is_unique,
      typeDesc: index.type_desc,
      hasFilter: index.has_filter,
      filterDefinition: index.filter_definition,
      keyColumns: indexes
        .filter(
          (candidate) =>
            candidate.object_id === table.object_id &&
            candidate.index_name === index.index_name &&
            !candidate.is_included_column,
        )
        .sort((left, right) => left.key_ordinal - right.key_ordinal)
        .map((candidate) => ({
          columnName: candidate.column_name,
          isDescending: candidate.is_descending_key,
        })),
      includedColumns: indexes
        .filter(
          (candidate) =>
            candidate.object_id === table.object_id &&
            candidate.index_name === index.index_name &&
            candidate.is_included_column,
        )
        .map((candidate) => candidate.column_name),
    }));

    return {
      objectId: table.object_id,
      schemaName: table.schema_name,
      tableName: table.table_name,
      columns: tableColumns,
      primaryKey,
      foreignKeys: tableForeignKeys,
      checkConstraints: tableChecks,
      indexes: tableIndexes,
    };
  });
}

async function getDefaultBackupPath(pool: QueryRunner): Promise<string> {
  const rows = await queryRows<DefaultBackupPathRow>(
    pool,
    `
      SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000)) AS default_backup_path;
    `,
  );
  const path = rows[0]?.default_backup_path?.trim();
  if (!path) {
    throw new Error("Instancia SQL Server sem caminho padrao de backup.");
  }
  return path;
}

async function runPhysicalBackup(
  pool: QueryRunner,
  connection: SqlServerConnectionConfig,
  timestamp: Date,
): Promise<PhysicalBackupSummary> {
  const defaultBackupPath = await getDefaultBackupPath(pool);
  const backupFileName = `${normalizePathSegment(
    connection.database,
  )}-${formatTimestampForFileName(timestamp)}.bak`;
  const remotePath = toWindowsPath(defaultBackupPath, backupFileName);

  try {
    await pool
      .request()
      .batch(
        `BACKUP DATABASE ${quoteIdentifier(
          connection.database,
        )} TO DISK = ${quoteUnicodeLiteral(
          remotePath,
        )} WITH COPY_ONLY, INIT, CHECKSUM, STATS = 10;`,
      );

    await pool
      .request()
      .batch(
        `RESTORE VERIFYONLY FROM DISK = ${quoteUnicodeLiteral(
          remotePath,
        )} WITH CHECKSUM;`,
      );

    return {
      remotePath,
      success: true,
      verified: true,
      downloadedLocally: false,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Falha desconhecida no backup fisico";

    return {
      remotePath,
      success: false,
      verified: false,
      downloadedLocally: false,
      errorMessage: message,
    };
  }
}

function buildSchemaPreDataSql(
  schemas: string[],
  tables: TableDefinition[],
): string {
  const statements = [
    "SET ANSI_NULLS ON;",
    "SET QUOTED_IDENTIFIER ON;",
    ...schemas
      .filter((schemaName) => schemaName !== "dbo")
      .map(
        (schemaName) =>
          `IF SCHEMA_ID(${quoteUnicodeLiteral(
            schemaName,
          )}) IS NULL EXEC('CREATE SCHEMA ${quoteIdentifier(schemaName)}');`,
      ),
    ...tables.map((table) => buildCreateTableStatement(table)),
  ];

  return `${statements.join("\n\n")}\n`;
}

function buildSchemaPostDataSql(tables: TableDefinition[]): string {
  const statements = tables.flatMap((table) => [
    ...table.checkConstraints.map((constraint) =>
      buildCheckConstraintStatement(table, constraint),
    ),
    ...table.foreignKeys.map((foreignKey) =>
      buildForeignKeyStatement(table, foreignKey),
    ),
    ...table.indexes
      .filter((index) => index.keyColumns.length > 0)
      .map((index) => buildIndexStatement(table, index)),
  ]);

  return `${statements.join("\n\n")}\n`;
}

async function exportTableData(
  pool: QueryRunner,
  table: TableDefinition,
  dataDir: string,
): Promise<TableExportSummary> {
  const writableColumns = table.columns.filter((column) => !column.isComputed);
  const columnList = writableColumns
    .map((column) => quoteIdentifier(column.columnName))
    .join(", ");
  const orderColumns =
    table.primaryKey?.columns ??
    writableColumns.slice(0, 1).map((column) => column.columnName);
  const orderByClause =
    orderColumns.length > 0
      ? ` ORDER BY ${orderColumns
          .map((columnName) => quoteIdentifier(columnName))
          .join(", ")}`
      : "";
  const sqlStatement = `SELECT ${columnList} FROM ${quoteQualifiedName(
    table.schemaName,
    table.tableName,
  )}${orderByClause};`;
  const rows = await queryRows<Record<string, unknown>>(pool, sqlStatement);
  const fileName = `${normalizePathSegment(table.schemaName)}.${normalizePathSegment(
    table.tableName,
  )}.sql`;
  const filePath = join(dataDir, fileName);

  const inserts: string[] = [];
  if (table.columns.some((column) => column.isIdentity)) {
    inserts.push(
      `SET IDENTITY_INSERT ${quoteQualifiedName(table.schemaName, table.tableName)} ON;`,
    );
  }

  if (rows.length > 0) {
    const batchSize = 250;
    for (let start = 0; start < rows.length; start += batchSize) {
      const batch = rows.slice(start, start + batchSize);
      const values = batch.map((row) => {
        const literals = writableColumns.map((column) =>
          renderSqlLiteral(row[column.columnName], column),
        );
        return `(${literals.join(", ")})`;
      });

      inserts.push(
        `INSERT INTO ${quoteQualifiedName(
          table.schemaName,
          table.tableName,
        )} (${columnList}) VALUES\n${values.join(",\n")};`,
      );
    }
  } else {
    inserts.push(
      `-- tabela vazia: ${quoteQualifiedName(table.schemaName, table.tableName)}`,
    );
  }

  if (table.columns.some((column) => column.isIdentity)) {
    inserts.push(
      `SET IDENTITY_INSERT ${quoteQualifiedName(table.schemaName, table.tableName)} OFF;`,
    );
  }

  await writeTextFile(filePath, `${inserts.join("\n\n")}\n`);

  return {
    schemaName: table.schemaName,
    tableName: table.tableName,
    rowCount: rows.length,
    dataFile: filePath,
  };
}

async function exportLogicalBackup(
  pool: QueryRunner,
  target: BackupTarget,
  outputDir: string,
): Promise<BackupSummary["logical"]> {
  const schemas = await getSchemas(pool);
  const tables = buildTableDefinitions(
    await getTables(pool),
    await getColumns(pool),
    await getPrimaryKeys(pool),
    await getForeignKeys(pool),
    await getCheckConstraints(pool),
    await getIndexes(pool),
  );

  const logicalDir = join(outputDir, "logical");
  const dataDir = join(logicalDir, "data");
  await ensureDirectory(dataDir);

  const schemaPrePath = join(logicalDir, "schema-pre-data.sql");
  const schemaPostPath = join(logicalDir, "schema-post-data.sql");
  const schemaPath = join(logicalDir, "schema.sql");
  const restorePath = join(logicalDir, "restore-logical.sql");
  const restorePortablePath = join(logicalDir, "restore-portable.sql");

  const schemaPreDataSql = buildSchemaPreDataSql(schemas, tables);
  const schemaPostDataSql = buildSchemaPostDataSql(tables);

  await writeTextFile(schemaPrePath, schemaPreDataSql);
  await writeTextFile(schemaPostPath, schemaPostDataSql);
  await writeTextFile(
    schemaPath,
    `${schemaPreDataSql}\nGO\n\n${schemaPostDataSql}`,
  );

  const tableSummaries: TableExportSummary[] = [];
  for (const table of tables) {
    tableSummaries.push(await exportTableData(pool, table, dataDir));
  }

  const restoreScript = buildRestoreScript(
    tableSummaries.map((table) => {
      const relativeFile = table.dataFile.split("/data/").at(-1);
      if (!relativeFile) {
        throw new Error(`Arquivo de dados invalido para ${table.tableName}`);
      }
      return relativeFile;
    }),
  );
  await writeTextFile(restorePath, `${restoreScript}\n`);
  const tableDataSql = await Promise.all(
    tableSummaries.map((summary) => readFile(summary.dataFile, "utf8")),
  );
  await writeTextFile(
    restorePortablePath,
    `${buildPortableRestoreScript(
      schemaPreDataSql,
      tableDataSql,
      schemaPostDataSql,
    )}\n`,
  );

  const filePaths = [
    schemaPrePath,
    schemaPostPath,
    schemaPath,
    restorePath,
    restorePortablePath,
    ...tableSummaries.map((summary) => summary.dataFile),
  ];
  const fileChecksums = await Promise.all(
    filePaths.map((path) => computeFileChecksum(path)),
  );

  await writeJsonFile(join(logicalDir, "manifest.json"), {
    database: target.connection.database,
    host: target.connection.host,
    exportedAt: new Date().toISOString(),
    schemas,
    tables: tableSummaries,
    fileChecksums,
  });

  return {
    schemas,
    tables: tableSummaries,
    fileChecksums,
  };
}

export async function runSqlServerBackups(
  targets: BackupTarget[],
  outputDir: string,
): Promise<BackupRunSummary> {
  const startedAt = new Date().toISOString();
  const resolvedOutputDir = resolve(outputDir);
  await ensureDirectory(resolvedOutputDir);

  const databases: BackupSummary[] = [];

  for (const target of targets) {
    const started = new Date();
    const databaseDir = join(
      resolvedOutputDir,
      `${normalizePathSegment(target.key)}-${normalizePathSegment(
        target.connection.database,
      )}`,
    );
    await ensureDirectory(databaseDir);

    const client = new SqlServerClient(target.connection);
    const databaseSummary = await client.withPool(async (pool) => {
      const physical = await runPhysicalBackup(
        pool,
        target.connection,
        started,
      );
      await writeJsonFile(join(databaseDir, "physical-backup.json"), physical);

      const logical = await exportLogicalBackup(pool, target, databaseDir);
      const completedAt = new Date().toISOString();

      const summary: BackupSummary = {
        key: target.key,
        database: target.connection.database,
        host: target.connection.host,
        startedAt: started.toISOString(),
        completedAt,
        outputDir: databaseDir,
        physical,
        logical,
      };

      await writeJsonFile(join(databaseDir, "summary.json"), summary);
      await writeTextFile(
        join(databaseDir, "README.md"),
        [
          `# Backup ${target.connection.database}`,
          "",
          `- Host: \`${target.connection.host}\``,
          `- Banco: \`${target.connection.database}\``,
          physical.success
            ? `- Backup fisico remoto verificado: \`${physical.remotePath}\``
            : `- Backup fisico remoto indisponivel: \`${physical.errorMessage ?? "sem detalhe"}\``,
          "- Restore logico: `logical/restore-logical.sql` com `sqlcmd`",
        ].join("\n"),
      );

      return summary;
    });

    databases.push(databaseSummary);
  }

  const completedAt = new Date().toISOString();
  const runSummary: BackupRunSummary = {
    startedAt,
    completedAt,
    outputDir: resolvedOutputDir,
    databases,
  };
  await writeJsonFile(join(resolvedOutputDir, "manifest.json"), runSummary);
  return runSummary;
}

export function resolveBackupOutputDir(baseDir?: string): string {
  if (baseDir && baseDir.trim().length > 0) {
    return resolve(baseDir.trim());
  }

  return resolve("backups", formatTimestampForFileName(new Date()));
}

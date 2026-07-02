export type SourceSystem = "source-a" | "source-b";

export type ColumnMetadata = {
  schemaName: string;
  tableName: string;
  columnName: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  foreignKeyTarget?: {
    schemaName: string;
    tableName: string;
    columnName: string;
  };
};

export type TableMetadata = {
  source: SourceSystem;
  schemaName: string;
  tableName: string;
  columns: ColumnMetadata[];
};

export type SchemaInspection = {
  source: SourceSystem;
  tables: TableMetadata[];
  inspectedAt: string;
};

export type PilotEntitySelection = {
  source: SourceSystem;
  schemaName: string;
  tableName: string;
  score: number;
  reasons: string[];
  selectedAt: string;
};

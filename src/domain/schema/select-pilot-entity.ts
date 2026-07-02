import { DomainError } from "../common/errors.ts";
import { type Result, failure, success } from "../common/result.ts";
import type {
  PilotEntitySelection,
  SchemaInspection,
  TableMetadata,
} from "./types.ts";

const disallowedNameTokens = ["junction", "join", "mapping", "xref", "bridge"];

const isLikelyJunctionTable = (table: TableMetadata): boolean => {
  const normalizedName = table.tableName.toLowerCase();
  if (disallowedNameTokens.some((token) => normalizedName.includes(token))) {
    return true;
  }

  const primaryKeys = table.columns.filter(
    (column) => column.isPrimaryKey,
  ).length;
  const foreignKeys = table.columns.filter(
    (column) => column.foreignKeyTarget,
  ).length;
  return primaryKeys >= 2 && foreignKeys >= 2 && table.columns.length <= 6;
};

const computeScore = (
  table: TableMetadata,
): { score: number; reasons: string[] } => {
  const reasons: string[] = [];
  let score = 100;

  const primaryKeys = table.columns.filter(
    (column) => column.isPrimaryKey,
  ).length;
  const foreignKeys = table.columns.filter(
    (column) => column.foreignKeyTarget,
  ).length;
  const nonNullableCount = table.columns.filter(
    (column) => !column.isNullable,
  ).length;

  if (isLikelyJunctionTable(table)) {
    score -= 50;
    reasons.push("penalized_junction_table");
  }

  if (primaryKeys !== 1) {
    score -= 25;
    reasons.push("penalized_non_simple_primary_key");
  } else {
    reasons.push("simple_primary_key");
  }

  score -= foreignKeys * 10;
  reasons.push(`foreign_keys_${foreignKeys}`);

  score -= nonNullableCount;
  reasons.push(`non_nullable_columns_${nonNullableCount}`);

  if (table.columns.length > 20) {
    score -= 10;
    reasons.push("penalized_wide_table");
  }

  return { score, reasons };
};

export const selectPilotEntity = (
  inspections: SchemaInspection[],
  nowIso: string,
): Result<PilotEntitySelection, DomainError> => {
  const candidates = inspections.flatMap((inspection) =>
    inspection.tables.map((table) => ({
      source: inspection.source,
      schemaName: table.schemaName,
      tableName: table.tableName,
      ...computeScore(table),
    })),
  );

  if (candidates.length === 0) {
    return failure(
      new DomainError(
        "INVALID_ENTITY_SELECTION",
        "No candidate tables were found during inspection.",
      ),
    );
  }

  const selected = [...candidates]
    .sort((left, right) => right.score - left.score)
    .at(0);

  if (!selected) {
    return failure(
      new DomainError(
        "INVALID_ENTITY_SELECTION",
        "No candidate table could be selected.",
      ),
    );
  }

  return success({
    source: selected.source,
    schemaName: selected.schemaName,
    tableName: selected.tableName,
    score: selected.score,
    reasons: selected.reasons,
    selectedAt: nowIso,
  });
};

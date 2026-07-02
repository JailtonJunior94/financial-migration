import { describe, expect, test } from "bun:test";
import { selectPilotEntity } from "../../src/domain/schema/select-pilot-entity.ts";
import type { SchemaInspection } from "../../src/domain/schema/types.ts";

const inspection: SchemaInspection = {
  source: "source-a",
  inspectedAt: "2026-01-01T00:00:00.000Z",
  tables: [
    {
      source: "source-a",
      schemaName: "dbo",
      tableName: "Customer",
      columns: [
        {
          schemaName: "dbo",
          tableName: "Customer",
          columnName: "id",
          dataType: "int",
          isNullable: false,
          isPrimaryKey: true,
        },
        {
          schemaName: "dbo",
          tableName: "Customer",
          columnName: "name",
          dataType: "varchar",
          isNullable: false,
          isPrimaryKey: false,
        },
      ],
    },
    {
      source: "source-a",
      schemaName: "dbo",
      tableName: "CustomerOrderMapping",
      columns: [
        {
          schemaName: "dbo",
          tableName: "CustomerOrderMapping",
          columnName: "customer_id",
          dataType: "int",
          isNullable: false,
          isPrimaryKey: true,
          foreignKeyTarget: {
            schemaName: "dbo",
            tableName: "Customer",
            columnName: "id",
          },
        },
        {
          schemaName: "dbo",
          tableName: "CustomerOrderMapping",
          columnName: "order_id",
          dataType: "int",
          isNullable: false,
          isPrimaryKey: true,
          foreignKeyTarget: {
            schemaName: "dbo",
            tableName: "Order",
            columnName: "id",
          },
        },
      ],
    },
  ],
};

describe("selectPilotEntity", () => {
  test("prefers a simple root table over a junction-like table", () => {
    const result = selectPilotEntity([inspection], "2026-01-02T00:00:00.000Z");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tableName).toBe("Customer");
      expect(result.value.schemaName).toBe("dbo");
    }
  });
});

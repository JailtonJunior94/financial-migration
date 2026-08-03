import { describe, expect, test } from "bun:test";
import {
  type TableDefinition,
  buildCreateTableStatement,
  quoteIdentifier,
  renderSqlLiteral,
} from "../../src/adapters/sqlserver/sqlserver-backup.ts";

describe("sqlserver backup helpers", () => {
  test("quoteIdentifier escapa colchetes", () => {
    expect(quoteIdentifier("a]b")).toBe("[a]]b]");
  });

  test("renderSqlLiteral suporta tipos comuns", () => {
    expect(renderSqlLiteral(null, { dataType: "nvarchar" })).toBe("NULL");
    expect(renderSqlLiteral("O'Hara", { dataType: "nvarchar" })).toBe(
      "N'O''Hara'",
    );
    expect(
      renderSqlLiteral("550e8400-e29b-41d4-a716-446655440000", {
        dataType: "uniqueidentifier",
      }),
    ).toBe("'550e8400-e29b-41d4-a716-446655440000'");
    expect(renderSqlLiteral(true, { dataType: "bit" })).toBe("1");
    expect(
      renderSqlLiteral(Buffer.from([0xde, 0xad]), { dataType: "varbinary" }),
    ).toBe("0xDEAD");
  });

  test("buildCreateTableStatement gera tabela com identidade, defaults e pk", () => {
    const table: TableDefinition = {
      objectId: 1,
      schemaName: "dbo",
      tableName: "Transactions",
      columns: [
        {
          columnId: 1,
          columnName: "Id",
          dataType: "int",
          maxLength: 4,
          precision: 10,
          scale: 0,
          isNullable: false,
          isIdentity: true,
          isComputed: false,
          collationName: null,
          defaultDefinition: null,
          identitySeed: "1",
          identityIncrement: "1",
          computedDefinition: null,
        },
        {
          columnId: 2,
          columnName: "Description",
          dataType: "nvarchar",
          maxLength: 200,
          precision: 0,
          scale: 0,
          isNullable: false,
          isIdentity: false,
          isComputed: false,
          collationName: null,
          defaultDefinition: "(N'')",
          identitySeed: null,
          identityIncrement: null,
          computedDefinition: null,
        },
      ],
      primaryKey: {
        constraintName: "PK_Transactions",
        indexTypeDesc: "CLUSTERED",
        columns: ["Id"],
      },
      foreignKeys: [],
      checkConstraints: [],
      indexes: [],
    };

    expect(buildCreateTableStatement(table)).toContain(
      "CONSTRAINT [PK_Transactions] PRIMARY KEY CLUSTERED ([Id])",
    );
    expect(buildCreateTableStatement(table)).toContain(
      "[Description] nvarchar(100) DEFAULT (N'') NOT NULL",
    );
  });
});

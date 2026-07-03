import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { $ } from "bun";

const tmpDir = "./tmp/cli-operational-test";
const checkpointFile = `${tmpDir}/checkpoint.json`;
const progressFile = `${tmpDir}/progress.json`;
const reviewDir = `${tmpDir}/review-artifacts`;
const bindingsDir = `${tmpDir}/remote-bindings`;

const env = {
  ...process.env,
  CHECKPOINT_FILE: checkpointFile,
  PROGRESS_FILE: progressFile,
  REVIEW_ARTIFACTS_DIR: reviewDir,
  REMOTE_BINDINGS_DIR: bindingsDir,
  OPENAPI_SPEC_PATH: "./openapi/target-service.openapi.json",
};

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

const userId = "06edc407-4f63-42e8-b07c-946b9ef0a19c";

describe("CLI operational commands", () => {
  test("checkpoint:list retorna vazio quando não há checkpoints", async () => {
    await mkdir(tmpDir, { recursive: true });
    const result = await $`bun run src/bootstrap/cli.ts checkpoint:list`
      .env(env)
      .quiet();

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toBe("{}\n");
  });

  test("progress:list retorna vazio quando não há progresso", async () => {
    await mkdir(tmpDir, { recursive: true });
    const result = await $`bun run src/bootstrap/cli.ts progress:list`
      .env(env)
      .quiet();

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toBe("{}\n");
  });

  test("review:list retorna vazio quando não há issues", async () => {
    await mkdir(tmpDir, { recursive: true });
    const result = await $`bun run src/bootstrap/cli.ts review:list`
      .env(env)
      .quiet();

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toBe("{}\n");
  });

  test("bindings:list retorna vazio quando não há bindings", async () => {
    await mkdir(tmpDir, { recursive: true });
    const result = await $`bun run src/bootstrap/cli.ts bindings:list`
      .env(env)
      .quiet();

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toBe("[]\n");
  });

  test("traceability:matrix gera matriz a partir de artefatos", async () => {
    await mkdir(tmpDir, { recursive: true });

    const snapshot = {
      discoveredAt: "2026-01-01T00:00:00.000Z",
      databases: ["FinancialControlDB"],
      tables: [
        {
          metadata: {
            database: "FinancialControlDB",
            schemaName: "dbo",
            tableName: "TransactionItem",
            columns: [],
            indexes: [],
            estimatedRowCount: 1,
            sampleSize: 1,
          },
          semantic: {
            role: "transaction_item",
            granularity: "detail",
            hasDirectUserLink: false,
            rationale: "Item de transação",
            risks: [],
          },
          samples: [
            {
              database: "FinancialControlDB",
              tableName: "TransactionItem",
              primaryKey: "1",
              fields: {},
            },
          ],
        },
      ],
    };

    const eligibility = {
      targetUser: {
        id: userId,
        email: "jailton.junior94@outlook.com",
        whatsappNumber: "+5511986896322",
        status: "ACTIVE",
      },
      matchedLegacyUsers: [],
      evidence: [],
      status: "eligible",
    };

    const consolidated = {
      transactions: [
        {
          factKey: {
            resource: "transaction",
            userId,
            occurredOn: "2026-01-10",
            normalizedDescription: "supermercado",
            normalizedAmountMinorUnits: "10000",
            currency: "BRL",
            paymentContext: { kind: "pix" },
            installmentContext: { kind: "single" },
          },
          kind: "expense",
          occurredOn: {
            value: "2026-01-10",
            sourceField: "transactionDate",
            fallbackUsed: false,
          },
          competence: "2026-01",
          description: "Supermercado",
          amount: { minorUnits: "10000", scale: 2, currency: "BRL" },
          paymentMethod: { kind: "pix" },
          installmentPlan: {
            groupKey: "tx-1",
            currentInstallment: 1,
            totalInstallments: 1,
          },
          legacyRefs: [
            {
              database: "FinancialControlDB",
              table: "TransactionItem",
              primaryKey: "1",
            },
          ],
          sourceSummary: {
            primarySource: "FinancialControlDB",
            secondarySources: [],
            notes: [],
          },
        },
      ],
    };

    const classified = {
      classified: [
        {
          transaction: consolidated.transactions[0],
          categoryId: "cat-1",
          subcategoryId: "sub-1",
          paymentMethod: { kind: "pix" },
          suggestedByOpenRouter: false,
        },
      ],
      blocked: [],
    };

    const issues: unknown[] = [];

    await writeFile(`${tmpDir}/snapshot.json`, JSON.stringify(snapshot));
    await writeFile(`${tmpDir}/eligibility.json`, JSON.stringify(eligibility));
    await writeFile(
      `${tmpDir}/consolidated.json`,
      JSON.stringify(consolidated),
    );
    await writeFile(`${tmpDir}/classified.json`, JSON.stringify(classified));
    await writeFile(`${tmpDir}/issues.json`, JSON.stringify(issues));

    const result =
      await $`bun run src/bootstrap/cli.ts traceability:matrix --snapshot ${tmpDir}/snapshot.json --eligibility ${tmpDir}/eligibility.json --consolidated ${tmpDir}/consolidated.json --classified ${tmpDir}/classified.json --issues ${tmpDir}/issues.json`
        .env(env)
        .quiet();

    expect(result.exitCode).toBe(0);
    const lines = result.stdout.toString().trim().split("\n");
    let matrix:
      | {
          rows: { consolidationStatus: string; classificationStatus: string }[];
        }
      | undefined;
    for (let index = 0; index < lines.length; index += 1) {
      const candidate = lines.slice(index).join("\n");
      try {
        const parsed = JSON.parse(candidate) as {
          rows: { consolidationStatus: string; classificationStatus: string }[];
        };
        if (Array.isArray(parsed.rows)) {
          matrix = parsed;
          break;
        }
      } catch {
        // continue scanning
      }
    }
    expect(matrix).toBeDefined();
    expect(matrix?.rows).toHaveLength(1);
    expect(matrix?.rows[0]?.consolidationStatus).toBe("included");
    expect(matrix?.rows[0]?.classificationStatus).toBe("classified");
  });
});

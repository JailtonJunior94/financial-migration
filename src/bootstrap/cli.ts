import { readFile, writeFile } from "node:fs/promises";
import { Command } from "commander";
import { CandidateSourceFromFile } from "../adapters/file/candidate-source-from-file.ts";
import { CategoryCatalogFromFile } from "../adapters/file/category-catalog-from-file.ts";
import { FactReaderFromFile } from "../adapters/file/fact-reader-from-file.ts";
import { NoOpSemanticEnrichmentAdapter } from "../adapters/semantic/noop-semantic-enrichment.ts";
import { OpenRouterSemanticEnrichmentAdapter } from "../adapters/semantic/openrouter-semantic-enrichment.ts";
import { BuildEligibilityScopeUseCase } from "../application/use-cases/build-eligibility-scope.ts";
import { BuildTraceabilityMatrixUseCase } from "../application/use-cases/build-traceability-matrix.ts";
import { ClassifyConsolidatedTransactionsUseCase } from "../application/use-cases/classify-consolidated-transactions.ts";
import { ConsolidateFinancialFactsUseCase } from "../application/use-cases/consolidate-financial-facts.ts";
import type {
  LegacyDatabase,
  ReviewableIssue,
} from "../domain/consolidation/types.ts";
import type {
  PipelineProgress,
  PipelineStage,
} from "../domain/publication/types.ts";
import {
  parseCards,
  parseClassifiedOutput,
  parseConsolidatedTransactions,
  parseDiscoverySnapshot,
  parseEligibilityScope,
  parseIssues,
} from "./cli-parsers.ts";
import { createOperationalRuntime } from "./composition/create-operational-runtime.ts";
import { createRuntime } from "./composition/create-runtime.ts";

const writeIssues = async (
  scope: string,
  issues: readonly ReviewableIssue[],
): Promise<void> => {
  if (issues.length === 0) {
    return;
  }
  const runtime = createOperationalRuntime();
  for (const issue of issues) {
    await runtime.reviewArtifactStore.append(scope, issue);
  }
};

const writeProgress = async (
  scope: string,
  stage: PipelineStage,
  counts: Omit<PipelineProgress, "scope" | "stage" | "updatedAt">,
): Promise<void> => {
  const runtime = createOperationalRuntime();
  await runtime.progressStore.write(scope, {
    scope,
    stage,
    ...counts,
    updatedAt: new Date().toISOString(),
  });
};

const program = new Command();

program
  .name("financial-migration")
  .description("Hexagonal CLI for financial migration workflows.");

program
  .command("schema:inspect")
  .description(
    "Inspect both SQL Server schemas and print the relevant DDL metadata.",
  )
  .action(async () => {
    const runtime = await createRuntime();
    if (!runtime.inspectSchemas) {
      throw new Error(
        "SQL Server configuration is required for schema inspection.",
      );
    }
    const inspections = await runtime.inspectSchemas.execute();
    console.log(JSON.stringify(inspections, null, 2));
  });

program
  .command("discovery:run")
  .description(
    "Run read-only discovery over the PRD scope and print a sanitized snapshot.",
  )
  .action(async () => {
    const runtime = await createRuntime();
    if (!runtime.discoverFinancialDomain) {
      throw new Error(
        "SQL Server configuration is required for domain discovery.",
      );
    }
    const snapshot = await runtime.discoverFinancialDomain.execute();
    console.log(JSON.stringify(snapshot, null, 2));
  });

program
  .command("pipeline:discover")
  .description(
    "Stage command: run read-only discovery and print a sanitized snapshot.",
  )
  .action(async () => {
    const runtime = await createRuntime();
    if (!runtime.discoverFinancialDomain) {
      throw new Error(
        "SQL Server configuration is required for domain discovery.",
      );
    }
    const snapshot = await runtime.discoverFinancialDomain.execute();
    console.log(JSON.stringify(snapshot, null, 2));
  });

program
  .command("pipeline:eligibility")
  .description(
    "Stage command: resolve target user eligibility from candidate file.",
  )
  .requiredOption(
    "--candidates <path>",
    "Path to JSON file with candidates array.",
  )
  .action(async (options: { candidates: string }) => {
    const runtime = await createRuntime();
    const useCase = new BuildEligibilityScopeUseCase(
      new CandidateSourceFromFile(options.candidates),
      runtime.logger,
    );
    const result = await useCase.execute({
      id:
        runtime.config.TARGET_USER_ID ?? "06edc407-4f63-42e8-b07c-946b9ef0a19c",
      email: "jailton.junior94@outlook.com",
      whatsappNumber: "+5511986896322",
      status: "ACTIVE",
    });

    if (result.ok) {
      await writeProgress("eligibility", "eligibility", {
        processedCount: result.value.evidence.length,
        publishedCount: 0,
        skippedCount: 0,
        blockedCount: result.value.status === "eligible" ? 0 : 1,
        reconciledCount: 0,
      });
    }

    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("pipeline:consolidate")
  .description(
    "Stage command: consolidate legacy facts into canonical transactions.",
  )
  .requiredOption("--facts <path>", "Path to JSON file with facts array.")
  .requiredOption(
    "--eligibility <path>",
    "Path to JSON file with eligibility scope.",
  )
  .option("--currency <currency>", "Currency code.", "BRL")
  .action(
    async (options: {
      facts: string;
      eligibility: string;
      currency: string;
    }) => {
      const runtime = await createRuntime();
      const eligibilityRaw = JSON.parse(
        await readFile(options.eligibility, "utf8"),
      ) as unknown;
      const eligibility = parseEligibilityScope(eligibilityRaw);
      const useCase = new ConsolidateFinancialFactsUseCase(
        new FactReaderFromFile(options.facts),
        runtime.logger,
      );
      const result = await useCase.execute({
        eligibilityScope: eligibility,
        currency: options.currency,
      });

      if (result.ok) {
        await writeIssues("consolidation", result.value.issues);
        await writeProgress("consolidation", "consolidation", {
          processedCount:
            result.value.transactions.length + result.value.issues.length,
          publishedCount: 0,
          skippedCount: 0,
          blockedCount: result.value.issues.length,
          reconciledCount: result.value.transactions.length,
        });
      }

      console.log(JSON.stringify(result, null, 2));
    },
  );

program
  .command("pipeline:classify")
  .description(
    "Stage command: classify consolidated transactions using a category catalog file.",
  )
  .requiredOption(
    "--transactions <path>",
    "Path to JSON file with consolidated transactions array.",
  )
  .requiredOption(
    "--catalog <path>",
    "Path to JSON file with category catalog (expense/income/dictionary).",
  )
  .action(async (options: { transactions: string; catalog: string }) => {
    const runtime = await createRuntime();
    const transactionsRaw = JSON.parse(
      await readFile(options.transactions, "utf8"),
    ) as unknown;
    const consolidated = parseConsolidatedTransactions(transactionsRaw);

    const semanticEnrichment =
      runtime.config.OPENROUTER_API_KEY &&
      runtime.config.OPENROUTER_API_BASE_URL
        ? new OpenRouterSemanticEnrichmentAdapter({
            baseUrl: runtime.config.OPENROUTER_API_BASE_URL,
            apiKey: runtime.config.OPENROUTER_API_KEY,
            model: runtime.config.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
          })
        : new NoOpSemanticEnrichmentAdapter();

    const useCase = new ClassifyConsolidatedTransactionsUseCase(
      new CategoryCatalogFromFile(options.catalog),
      semanticEnrichment,
      runtime.logger,
    );

    const result = await useCase.execute({
      transactions: consolidated.transactions,
    });

    await writeIssues("classification", result.blocked);
    await writeProgress("classification", "classification", {
      processedCount: result.classified.length + result.blocked.length,
      publishedCount: 0,
      skippedCount: 0,
      blockedCount: result.blocked.length,
      reconciledCount: result.classified.length,
    });

    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("pipeline:publish-cards")
  .description("Stage command: publish consolidated cards to the target API.")
  .requiredOption(
    "--cards <path>",
    "Path to JSON file with consolidated cards array.",
  )
  .action(async (options: { cards: string }) => {
    const runtime = await createRuntime();
    if (!runtime.publishCards) {
      throw new Error(
        "TARGET_API_BASE_URL, TARGET_USER_ID and TARGET_GATEWAY_SECRET are required for card publication.",
      );
    }
    const cardsRaw = JSON.parse(
      await readFile(options.cards, "utf8"),
    ) as unknown;
    const cards = parseCards(cardsRaw);
    const result = await runtime.publishCards.execute({
      userId:
        runtime.config.TARGET_USER_ID ?? "06edc407-4f63-42e8-b07c-946b9ef0a19c",
      cards: cards.cards,
    });

    if (result.ok) {
      await writeIssues("card_publication", result.value.issues);
      await writeProgress("card_publication", "card_publication", {
        processedCount:
          result.value.published.length + result.value.skipped.length,
        publishedCount: result.value.published.length,
        skippedCount: result.value.skipped.length,
        blockedCount: result.value.issues.length,
        reconciledCount: result.value.skipped.length,
      });
    }

    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("pipeline:publish-transactions")
  .description(
    "Stage command: publish classified transactions to the target API with GET-before-POST reconciliation.",
  )
  .requiredOption(
    "--classified <path>",
    "Path to JSON file with classified transactions output.",
  )
  .option(
    "--scope <scope>",
    "Progress and review artifact scope.",
    "transaction_publication",
  )
  .action(async (options: { classified: string; scope: string }) => {
    const runtime = await createRuntime();
    if (!runtime.publishTransactions) {
      throw new Error(
        "TARGET_API_BASE_URL, TARGET_USER_ID and TARGET_GATEWAY_SECRET are required for transaction publication.",
      );
    }
    const classifiedRaw = JSON.parse(
      await readFile(options.classified, "utf8"),
    ) as unknown;
    const classified = parseClassifiedOutput(classifiedRaw);
    const result = await runtime.publishTransactions.execute({
      scope: options.scope,
      userId:
        runtime.config.TARGET_USER_ID ?? "06edc407-4f63-42e8-b07c-946b9ef0a19c",
      classified: classified.classified,
    });

    if (result.ok) {
      await writeProgress(options.scope, "transaction_publication", {
        processedCount:
          result.value.published.length +
          result.value.skipped.length +
          result.value.blocked.length,
        publishedCount: result.value.published.length,
        skippedCount: result.value.skipped.length,
        blockedCount: result.value.blocked.length,
        reconciledCount: result.value.skipped.length,
      });
    }

    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("schema:select-pilot")
  .description(
    "Inspect both SQL Server schemas and persist the selected pilot entity.",
  )
  .action(async () => {
    const runtime = await createRuntime();
    if (!runtime.inspectSchemas) {
      throw new Error(
        "SQL Server configuration is required for schema inspection.",
      );
    }
    const inspections = await runtime.inspectSchemas.execute();
    const selection = runtime.selectPilotEntity.execute(inspections);
    await runtime.pilotSelectionStore.write(selection);
    console.log(JSON.stringify(selection, null, 2));
  });

program
  .command("sync:pilot")
  .description("Run the pilot entity migration workflow.")
  .option("--dry-run", "Skip HTTP POST but keep mapping and checkpoint flow.")
  .action(async (options: { dryRun?: boolean }) => {
    const runtime = await createRuntime();
    if (!runtime.syncPilotEntity) {
      throw new Error(
        "SQL Server and target API configuration are required for pilot sync.",
      );
    }
    const selection = await runtime.pilotSelectionStore.read();
    if (!selection) {
      throw new Error(
        "Pilot selection not found. Run `schema:select-pilot` first.",
      );
    }

    const result = await runtime.syncPilotEntity.execute(
      selection,
      Boolean(options.dryRun),
    );
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("checkpoint:list")
  .description("List stored checkpoints.")
  .action(async () => {
    const runtime = createOperationalRuntime();
    const checkpoints = await runtime.checkpoint.list();
    console.log(JSON.stringify(checkpoints, null, 2));
  });

program
  .command("checkpoint:reset")
  .description("Reset all checkpoints or a specific scope.")
  .argument("[scope]", "Optional checkpoint scope to remove.")
  .action(async (scope?: string) => {
    const runtime = createOperationalRuntime();
    await runtime.checkpoint.reset(scope);
    console.log(JSON.stringify({ reset: scope ?? "all" }, null, 2));
  });

program
  .command("progress:list")
  .description("List operational progress records.")
  .action(async () => {
    const runtime = createOperationalRuntime();
    const progress = await runtime.progressStore.list();
    console.log(JSON.stringify(progress, null, 2));
  });

program
  .command("progress:reset")
  .description("Reset all progress records or a specific scope.")
  .argument("[scope]", "Optional progress scope to remove.")
  .action(async (scope?: string) => {
    const runtime = createOperationalRuntime();
    await runtime.progressStore.reset(scope);
    console.log(JSON.stringify({ reset: scope ?? "all" }, null, 2));
  });

program
  .command("review:list")
  .description("List review artifacts for a scope or all scopes.")
  .argument("[scope]", "Optional review artifact scope.")
  .action(async (scope?: string) => {
    const runtime = createOperationalRuntime();
    if (scope) {
      const issues = await runtime.reviewArtifactStore.read(scope);
      console.log(JSON.stringify({ scope, issues }, null, 2));
      return;
    }

    const scopes = await runtime.reviewArtifactStore.listScopes();
    const output: Record<string, unknown> = {};
    for (const s of scopes) {
      output[s] = await runtime.reviewArtifactStore.read(s);
    }
    console.log(JSON.stringify(output, null, 2));
  });

program
  .command("review:reset")
  .description("Reset review artifacts for a scope or all scopes.")
  .argument("[scope]", "Optional review artifact scope to remove.")
  .action(async (scope?: string) => {
    const runtime = createOperationalRuntime();
    await runtime.reviewArtifactStore.reset(scope);
    console.log(JSON.stringify({ reset: scope ?? "all" }, null, 2));
  });

program
  .command("bindings:list")
  .description("List persisted remote card bindings.")
  .action(async () => {
    const runtime = createOperationalRuntime();
    const bindings = await runtime.remoteBindingStore.list();
    console.log(JSON.stringify(bindings, null, 2));
  });

program
  .command("bindings:reset")
  .description(
    "Reset all remote bindings or a specific legacy ref (database:table:primaryKey).",
  )
  .argument("[ref]", "Optional legacy ref in database:table:primaryKey format.")
  .action(async (ref?: string) => {
    const runtime = createOperationalRuntime();
    if (ref) {
      const parts = ref.split(":");
      if (parts.length !== 3) {
        throw new Error(
          "Legacy ref must be in database:table:primaryKey format.",
        );
      }
      const [database, table, primaryKey] = parts;
      await runtime.remoteBindingStore.reset({
        database: database as LegacyDatabase,
        table: table!,
        primaryKey: primaryKey!,
      });
    } else {
      await runtime.remoteBindingStore.reset();
    }
    console.log(JSON.stringify({ reset: ref ?? "all" }, null, 2));
  });

program
  .command("traceability:matrix")
  .description("Build a traceability matrix from pipeline artifacts.")
  .requiredOption("--snapshot <path>", "Path to discovery snapshot JSON file.")
  .requiredOption(
    "--eligibility <path>",
    "Path to eligibility scope JSON file.",
  )
  .requiredOption(
    "--consolidated <path>",
    "Path to consolidated transactions JSON file.",
  )
  .requiredOption(
    "--classified <path>",
    "Path to classified transactions JSON file.",
  )
  .requiredOption("--issues <path>", "Path to issues JSON file.")
  .option("--output <path>", "Optional output file path.")
  .action(
    async (options: {
      snapshot: string;
      eligibility: string;
      consolidated: string;
      classified: string;
      issues: string;
      output?: string;
    }) => {
      const runtime = createOperationalRuntime();

      const snapshot = parseDiscoverySnapshot(
        JSON.parse(await readFile(options.snapshot, "utf8")) as unknown,
      );
      const eligibility = parseEligibilityScope(
        JSON.parse(await readFile(options.eligibility, "utf8")) as unknown,
      );
      const consolidated = parseConsolidatedTransactions(
        JSON.parse(await readFile(options.consolidated, "utf8")) as unknown,
      );
      const classified = parseClassifiedOutput(
        JSON.parse(await readFile(options.classified, "utf8")) as unknown,
      );
      const issues = parseIssues(
        JSON.parse(await readFile(options.issues, "utf8")) as unknown,
      );

      const sourceRefs = snapshot.tables.flatMap((table) =>
        table.samples.map((sample) => ({
          database: sample.database,
          table: sample.tableName,
          primaryKey: sample.primaryKey,
        })),
      );

      const matrix = runtime.buildTraceabilityMatrix.execute({
        eligibilityStatus: eligibility.status,
        targetUserId: eligibility.targetUser.id,
        sourceRefs,
        transactions: consolidated.transactions,
        classified: classified.classified,
        issues: [...issues, ...classified.blocked],
      });

      const output = JSON.stringify(matrix, null, 2);
      if (options.output) {
        await writeFile(options.output, output, "utf8");
      }
      console.log(output);
    },
  );

program
  .command("openapi:dump-example")
  .description(
    "Materialize the bundled example OpenAPI contract into the working tree.",
  )
  .action(async () => {
    const bundledSpec = await Bun.file(
      "./openapi/target-service.openapi.json",
    ).text();
    await writeFile(
      "./openapi/target-service.openapi.json",
      bundledSpec,
      "utf8",
    );
    console.log(
      JSON.stringify(
        { path: "./openapi/target-service.openapi.json" },
        null,
        2,
      ),
    );
  });

await program.parseAsync(process.argv);

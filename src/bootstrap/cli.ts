import { writeFile } from "node:fs/promises";
import { Command } from "commander";
import { createRuntime } from "./composition/create-runtime.ts";

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
    const inspections = await runtime.inspectSchemas.execute();
    console.log(JSON.stringify(inspections, null, 2));
  });

program
  .command("schema:select-pilot")
  .description(
    "Inspect both SQL Server schemas and persist the selected pilot entity.",
  )
  .action(async () => {
    const runtime = await createRuntime();
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
    const runtime = await createRuntime();
    const checkpoints = await runtime.checkpoint.list();
    console.log(JSON.stringify(checkpoints, null, 2));
  });

program
  .command("checkpoint:reset")
  .description("Reset all checkpoints or a specific scope.")
  .argument("[scope]", "Optional checkpoint scope to remove.")
  .action(async (scope?: string) => {
    const runtime = await createRuntime();
    await runtime.checkpoint.reset(scope);
    console.log(JSON.stringify({ reset: scope ?? "all" }, null, 2));
  });

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

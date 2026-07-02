import type { SchemaInspection } from "../../domain/schema/types.ts";
import type { LoggerPort } from "../ports/logger-port.ts";
import type { SchemaIntrospectionPort } from "../ports/schema-introspection-port.ts";

export class InspectSchemasUseCase {
  constructor(
    private readonly sources: SchemaIntrospectionPort[],
    private readonly logger: LoggerPort,
  ) {}

  async execute(): Promise<SchemaInspection[]> {
    const inspections = await Promise.all(
      this.sources.map((source) => source.inspect()),
    );
    this.logger.info("Schema inspection completed.", {
      sources: inspections.map((inspection) => inspection.source),
      tableCount: inspections.reduce(
        (total, inspection) => total + inspection.tables.length,
        0,
      ),
    });
    return inspections;
  }
}

import {
  type BuildTraceabilityMatrixInput,
  type TraceabilityMatrix,
  buildTraceabilityMatrix,
} from "../../domain/publication/traceability.ts";
import type { LoggerPort } from "../ports/logger-port.ts";

export class BuildTraceabilityMatrixUseCase {
  constructor(private readonly logger: LoggerPort) {}

  execute(input: BuildTraceabilityMatrixInput): TraceabilityMatrix {
    this.logger.info("Iniciando construção da matriz de rastreabilidade.", {
      sourceRefCount: input.sourceRefs.length,
      transactionCount: input.transactions.length,
      classifiedCount: input.classified.length,
      issueCount: input.issues.length,
    });

    const matrix = buildTraceabilityMatrix(input);

    const included = matrix.rows.filter(
      (row) => row.consolidationStatus === "included",
    ).length;
    const blocked = matrix.rows.filter(
      (row) => row.classificationStatus === "blocked" || row.issueId,
    ).length;
    const published = matrix.rows.filter((row) => row.remoteId).length;

    this.logger.info("Matriz de rastreabilidade construída.", {
      rowCount: matrix.rows.length,
      included,
      blocked,
      published,
    });

    return matrix;
  }
}

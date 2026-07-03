import { expectedTableCount } from "../../domain/discovery/scope.ts";
import type { FinancialDiscoverySnapshot } from "../../domain/discovery/types.ts";
import type { LoggerPort } from "../ports/logger-port.ts";
import type { SourceDomainDiscoveryPort } from "../ports/source-domain-discovery-port.ts";

export class DiscoverFinancialDomainUseCase {
  constructor(
    private readonly sources: readonly SourceDomainDiscoveryPort[],
    private readonly logger: LoggerPort,
  ) {}

  async execute(): Promise<FinancialDiscoverySnapshot> {
    this.logger.info("Iniciando descoberta do domínio financeiro.", {
      expectedDatabases: this.sources.length,
      expectedTables: expectedTableCount(),
    });

    const snapshots = await Promise.all(
      this.sources.map((source) => source.inspectScope()),
    );

    const tables = snapshots.flatMap((snapshot) => snapshot.tables);
    const databases = [
      ...new Set(snapshots.flatMap((snapshot) => snapshot.databases)),
    ];

    const snapshot: FinancialDiscoverySnapshot = {
      discoveredAt: new Date().toISOString(),
      databases,
      tables,
    };

    this.logger.info("Descoberta do domínio financeiro concluída.", {
      databases: snapshot.databases,
      tableCount: snapshot.tables.length,
      totalSamples: snapshot.tables.reduce(
        (total, table) => total + table.samples.length,
        0,
      ),
    });

    return snapshot;
  }
}

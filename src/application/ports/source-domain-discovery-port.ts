import type { FinancialDiscoverySnapshot } from "../../domain/discovery/types.ts";

export interface SourceDomainDiscoveryPort {
  inspectScope(): Promise<FinancialDiscoverySnapshot>;
}

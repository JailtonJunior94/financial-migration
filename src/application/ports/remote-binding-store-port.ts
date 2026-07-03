import type { LegacySourceRef } from "../../domain/consolidation/types.ts";
import type { RemoteCardBinding } from "../../domain/publication/types.ts";

export interface RemoteBindingStorePort {
  readCard(ref: LegacySourceRef): Promise<RemoteCardBinding | undefined>;
  writeCard(binding: RemoteCardBinding): Promise<void>;
}

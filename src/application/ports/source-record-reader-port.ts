import type { PilotEntitySelection } from "../../domain/schema/types.ts";
import type { SourceRecord, SyncCursor } from "../../domain/sync/types.ts";

export type SourceRecordBatch = {
  records: SourceRecord[];
  nextCursor: SyncCursor | undefined;
};

export interface SourceRecordReaderPort {
  read(
    selection: PilotEntitySelection,
    cursor?: SyncCursor,
  ): Promise<SourceRecordBatch>;
}

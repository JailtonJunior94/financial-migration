import type {
  SourceRecordBatch,
  SourceRecordReaderPort,
} from "../../application/ports/source-record-reader-port.ts";
import type { PilotEntitySelection } from "../../domain/schema/types.ts";
import type { SyncCursor } from "../../domain/sync/types.ts";

export class SourceRecordReaderRouter implements SourceRecordReaderPort {
  constructor(
    private readonly readers: Record<string, SourceRecordReaderPort>,
  ) {}

  async read(
    selection: PilotEntitySelection,
    cursor?: SyncCursor,
  ): Promise<SourceRecordBatch> {
    const reader = this.readers[selection.source];
    if (!reader) {
      throw new Error(`No source reader registered for ${selection.source}.`);
    }

    return reader.read(selection, cursor);
  }
}

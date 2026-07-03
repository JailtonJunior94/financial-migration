import type { PipelineProgress } from "../../domain/publication/types.ts";

export interface ProgressStorePort {
  read(scope: string): Promise<PipelineProgress | undefined>;
  write(scope: string, value: PipelineProgress): Promise<void>;
}

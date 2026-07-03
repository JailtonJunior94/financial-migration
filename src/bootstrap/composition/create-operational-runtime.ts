import { FileCheckpointStore } from "../../adapters/checkpoint/file-checkpoint-store.ts";
import { FileProgressStore } from "../../adapters/checkpoint/file-progress-store.ts";
import { FileRemoteBindingStore } from "../../adapters/checkpoint/file-remote-binding-store.ts";
import { FileReviewArtifactStore } from "../../adapters/checkpoint/file-review-artifact-store.ts";
import { PinoLoggerAdapter } from "../../adapters/logger/pino-logger.ts";
import { BuildTraceabilityMatrixUseCase } from "../../application/use-cases/build-traceability-matrix.ts";
import { loadConfig } from "../config.ts";

export const createOperationalRuntime = () => {
  const config = loadConfig();
  const logger = new PinoLoggerAdapter();

  const checkpoint = new FileCheckpointStore(config.CHECKPOINT_FILE);
  const progressStore = new FileProgressStore(config.PROGRESS_FILE);
  const reviewArtifactStore = new FileReviewArtifactStore(
    config.REVIEW_ARTIFACTS_DIR,
  );
  const remoteBindingStore = new FileRemoteBindingStore(
    config.REMOTE_BINDINGS_DIR,
  );

  return {
    config,
    logger,
    checkpoint,
    progressStore,
    reviewArtifactStore,
    remoteBindingStore,
    buildTraceabilityMatrix: new BuildTraceabilityMatrixUseCase(logger),
  };
};

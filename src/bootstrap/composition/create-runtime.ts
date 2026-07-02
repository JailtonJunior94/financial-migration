import { access } from "node:fs/promises";
import { FileCheckpointStore } from "../../adapters/checkpoint/file-checkpoint-store.ts";
import { FilePilotSelectionStore } from "../../adapters/checkpoint/file-pilot-selection-store.ts";
import { OpenApiTargetServiceAdapter } from "../../adapters/http/openapi-target-service.ts";
import { PinoLoggerAdapter } from "../../adapters/logger/pino-logger.ts";
import { SourceRecordReaderRouter } from "../../adapters/sqlserver/source-record-reader-router.ts";
import { SqlServerClient } from "../../adapters/sqlserver/sqlserver-client.ts";
import { SqlServerSchemaIntrospectionAdapter } from "../../adapters/sqlserver/sqlserver-schema-introspection.ts";
import { SqlServerSourceRecordReaderAdapter } from "../../adapters/sqlserver/sqlserver-source-record-reader.ts";
import { InspectSchemasUseCase } from "../../application/use-cases/inspect-schemas.ts";
import { SelectPilotEntityUseCase } from "../../application/use-cases/select-pilot-entity.ts";
import { SyncPilotEntityUseCase } from "../../application/use-cases/sync-pilot-entity.ts";
import { loadConfig } from "../config.ts";

const clock = {
  nowIso: () => new Date().toISOString(),
};

export const createRuntime = async () => {
  const config = loadConfig();
  await access(config.OPENAPI_SPEC_PATH);

  const logger = new PinoLoggerAdapter();
  const sourceAClient = new SqlServerClient({
    source: "source-a",
    host: config.FINANCIALCONTROLDB_SQLSERVER_HOST,
    port: config.FINANCIALCONTROLDB_SQLSERVER_PORT,
    database: config.FINANCIALCONTROLDB_SQLSERVER_DATABASE,
    user: config.FINANCIALCONTROLDB_SQLSERVER_USER,
    password: config.FINANCIALCONTROLDB_SQLSERVER_PASSWORD,
    encrypt: config.FINANCIALCONTROLDB_SQLSERVER_ENCRYPT,
    trustServerCertificate:
      config.FINANCIALCONTROLDB_SQLSERVER_TRUST_SERVER_CERTIFICATE,
  });
  const sourceBClient = new SqlServerClient({
    source: "source-b",
    host: config.ACCOUNTCONTROLDB_SQLSERVER_HOST,
    port: config.ACCOUNTCONTROLDB_SQLSERVER_PORT,
    database: config.ACCOUNTCONTROLDB_SQLSERVER_DATABASE,
    user: config.ACCOUNTCONTROLDB_SQLSERVER_USER,
    password: config.ACCOUNTCONTROLDB_SQLSERVER_PASSWORD,
    encrypt: config.ACCOUNTCONTROLDB_SQLSERVER_ENCRYPT,
    trustServerCertificate:
      config.ACCOUNTCONTROLDB_SQLSERVER_TRUST_SERVER_CERTIFICATE,
  });

  const sourceAInspection = new SqlServerSchemaIntrospectionAdapter(
    sourceAClient,
  );
  const sourceBInspection = new SqlServerSchemaIntrospectionAdapter(
    sourceBClient,
  );

  const checkpoint = new FileCheckpointStore(config.CHECKPOINT_FILE);
  const pilotSelectionStore = new FilePilotSelectionStore(
    config.PILOT_SELECTION_FILE,
  );

  return {
    config,
    logger,
    checkpoint,
    pilotSelectionStore,
    inspectSchemas: new InspectSchemasUseCase(
      [sourceAInspection, sourceBInspection],
      logger,
    ),
    selectPilotEntity: new SelectPilotEntityUseCase(clock, logger),
    syncPilotEntity: new SyncPilotEntityUseCase({
      reader: new SourceRecordReaderRouter({
        "source-a": new SqlServerSourceRecordReaderAdapter(sourceAClient),
        "source-b": new SqlServerSourceRecordReaderAdapter(sourceBClient),
      }),
      target: new OpenApiTargetServiceAdapter({
        baseUrl: config.TARGET_API_BASE_URL,
        token: config.TARGET_API_TOKEN,
        path: config.TARGET_API_POST_PATH,
        idempotencyHeader: config.TARGET_API_IDEMPOTENCY_HEADER,
      }),
      checkpoint,
      clock,
      logger,
    }),
  };
};

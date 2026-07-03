import { access } from "node:fs/promises";
import { FileCheckpointStore } from "../../adapters/checkpoint/file-checkpoint-store.ts";
import { FilePilotSelectionStore } from "../../adapters/checkpoint/file-pilot-selection-store.ts";
import { FileProgressStore } from "../../adapters/checkpoint/file-progress-store.ts";
import { FileRemoteBindingStore } from "../../adapters/checkpoint/file-remote-binding-store.ts";
import { FileReviewArtifactStore } from "../../adapters/checkpoint/file-review-artifact-store.ts";
import { MecontrolaCardTargetAdapter } from "../../adapters/http/mecontrola-cards.ts";
import { MecontrolaTransactionTargetAdapter } from "../../adapters/http/mecontrola-transactions.ts";
import { OpenApiTargetServiceAdapter } from "../../adapters/http/openapi-target-service.ts";
import { PinoLoggerAdapter } from "../../adapters/logger/pino-logger.ts";
import { SourceRecordReaderRouter } from "../../adapters/sqlserver/source-record-reader-router.ts";
import { SqlServerClient } from "../../adapters/sqlserver/sqlserver-client.ts";
import { SqlServerDomainDiscoveryAdapter } from "../../adapters/sqlserver/sqlserver-domain-discovery.ts";
import { SqlServerSchemaIntrospectionAdapter } from "../../adapters/sqlserver/sqlserver-schema-introspection.ts";
import { SqlServerSourceRecordReaderAdapter } from "../../adapters/sqlserver/sqlserver-source-record-reader.ts";
import { DiscoverFinancialDomainUseCase } from "../../application/use-cases/discover-financial-domain.ts";
import { InspectSchemasUseCase } from "../../application/use-cases/inspect-schemas.ts";
import { PublishCardsUseCase } from "../../application/use-cases/publish-cards.ts";
import { PublishTransactionsUseCase } from "../../application/use-cases/publish-transactions.ts";
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

  const financialHost = config.FINANCIALCONTROLDB_SQLSERVER_HOST;
  const financialDatabase = config.FINANCIALCONTROLDB_SQLSERVER_DATABASE;
  const financialUser = config.FINANCIALCONTROLDB_SQLSERVER_USER;
  const financialPassword = config.FINANCIALCONTROLDB_SQLSERVER_PASSWORD;
  const accountHost = config.ACCOUNTCONTROLDB_SQLSERVER_HOST;
  const accountDatabase = config.ACCOUNTCONTROLDB_SQLSERVER_DATABASE;
  const accountUser = config.ACCOUNTCONTROLDB_SQLSERVER_USER;
  const accountPassword = config.ACCOUNTCONTROLDB_SQLSERVER_PASSWORD;

  const hasFinancialConfig = Boolean(
    financialHost && financialDatabase && financialUser && financialPassword,
  );
  const hasAccountConfig = Boolean(
    accountHost && accountDatabase && accountUser && accountPassword,
  );

  const sourceAClient = hasFinancialConfig
    ? new SqlServerClient({
        source: "source-a",
        host: financialHost!,
        port: config.FINANCIALCONTROLDB_SQLSERVER_PORT,
        database: financialDatabase!,
        user: financialUser!,
        password: financialPassword!,
        encrypt: config.FINANCIALCONTROLDB_SQLSERVER_ENCRYPT,
        trustServerCertificate:
          config.FINANCIALCONTROLDB_SQLSERVER_TRUST_SERVER_CERTIFICATE,
      })
    : undefined;

  const sourceBClient = hasAccountConfig
    ? new SqlServerClient({
        source: "source-b",
        host: accountHost!,
        port: config.ACCOUNTCONTROLDB_SQLSERVER_PORT,
        database: accountDatabase!,
        user: accountUser!,
        password: accountPassword!,
        encrypt: config.ACCOUNTCONTROLDB_SQLSERVER_ENCRYPT,
        trustServerCertificate:
          config.ACCOUNTCONTROLDB_SQLSERVER_TRUST_SERVER_CERTIFICATE,
      })
    : undefined;

  const sourceAInspection = sourceAClient
    ? new SqlServerSchemaIntrospectionAdapter(sourceAClient)
    : undefined;
  const sourceBInspection = sourceBClient
    ? new SqlServerSchemaIntrospectionAdapter(sourceBClient)
    : undefined;

  const financialDiscovery = sourceAClient
    ? new SqlServerDomainDiscoveryAdapter(sourceAClient, "FinancialControlDB")
    : undefined;
  const accountDiscovery = sourceBClient
    ? new SqlServerDomainDiscoveryAdapter(sourceBClient, "AccountControlDB")
    : undefined;

  const checkpoint = new FileCheckpointStore(config.CHECKPOINT_FILE);
  const progressStore = new FileProgressStore(config.PROGRESS_FILE);
  const pilotSelectionStore = new FilePilotSelectionStore(
    config.PILOT_SELECTION_FILE,
  );
  const reviewArtifactStore = new FileReviewArtifactStore(
    config.REVIEW_ARTIFACTS_DIR,
  );
  const remoteBindingStore = new FileRemoteBindingStore(
    config.REMOTE_BINDINGS_DIR,
  );

  const inspections: InspectSchemasUseCase["sources"][number][] = [];
  if (sourceAInspection) inspections.push(sourceAInspection);
  if (sourceBInspection) inspections.push(sourceBInspection);

  const discoveries: DiscoverFinancialDomainUseCase["sources"][number][] = [];
  if (financialDiscovery) discoveries.push(financialDiscovery);
  if (accountDiscovery) discoveries.push(accountDiscovery);

  return {
    config,
    logger,
    checkpoint,
    progressStore,
    pilotSelectionStore,
    reviewArtifactStore,
    remoteBindingStore,
    inspectSchemas:
      inspections.length > 0
        ? new InspectSchemasUseCase(inspections, logger)
        : undefined,
    discoverFinancialDomain:
      discoveries.length > 0
        ? new DiscoverFinancialDomainUseCase(discoveries, logger)
        : undefined,
    selectPilotEntity: new SelectPilotEntityUseCase(clock, logger),
    syncPilotEntity:
      sourceAClient && sourceBClient
        ? new SyncPilotEntityUseCase({
            reader: new SourceRecordReaderRouter({
              "source-a": new SqlServerSourceRecordReaderAdapter(sourceAClient),
              "source-b": new SqlServerSourceRecordReaderAdapter(sourceBClient),
            }),
            target: new OpenApiTargetServiceAdapter({
              baseUrl: config.TARGET_API_BASE_URL ?? "",
              token: config.TARGET_API_TOKEN ?? "",
              path: config.TARGET_API_POST_PATH,
              idempotencyHeader: config.TARGET_API_IDEMPOTENCY_HEADER,
            }),
            checkpoint,
            clock,
            logger,
          })
        : undefined,
    publishCards:
      config.TARGET_API_BASE_URL &&
      config.TARGET_USER_ID &&
      config.TARGET_GATEWAY_SECRET
        ? new PublishCardsUseCase({
            cardTarget: new MecontrolaCardTargetAdapter({
              baseUrl: config.TARGET_API_BASE_URL,
              gatewayAuth: {
                userId: config.TARGET_USER_ID,
                gatewaySecretHex: config.TARGET_GATEWAY_SECRET,
              },
            }),
            bindingStore: remoteBindingStore,
            clock,
            logger,
          })
        : undefined,
    publishTransactions:
      config.TARGET_API_BASE_URL &&
      config.TARGET_USER_ID &&
      config.TARGET_GATEWAY_SECRET
        ? new PublishTransactionsUseCase({
            transactionTarget: new MecontrolaTransactionTargetAdapter({
              baseUrl: config.TARGET_API_BASE_URL,
              gatewayAuth: {
                userId: config.TARGET_USER_ID,
                gatewaySecretHex: config.TARGET_GATEWAY_SECRET,
              },
            }),
            progressStore,
            reviewArtifactStore,
            clock,
            logger,
          })
        : undefined,
  };
};

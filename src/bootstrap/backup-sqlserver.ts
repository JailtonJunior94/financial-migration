import { z } from "zod";
import {
  type BackupTarget,
  resolveBackupOutputDir,
  runSqlServerBackups,
} from "../adapters/sqlserver/sqlserver-backup.ts";
import type { SqlServerConnectionConfig } from "../adapters/sqlserver/sqlserver-client.ts";

const backupEnvSchema = z.object({
  FINANCIALCONTROLDB_SQLSERVER_HOST: z.string().min(1),
  FINANCIALCONTROLDB_SQLSERVER_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(1433),
  FINANCIALCONTROLDB_SQLSERVER_DATABASE: z.string().min(1),
  FINANCIALCONTROLDB_SQLSERVER_USER: z.string().min(1),
  FINANCIALCONTROLDB_SQLSERVER_PASSWORD: z.string().min(1),
  FINANCIALCONTROLDB_SQLSERVER_ENCRYPT: z.coerce.boolean().default(false),
  FINANCIALCONTROLDB_SQLSERVER_TRUST_SERVER_CERTIFICATE: z.coerce
    .boolean()
    .default(false),

  ACCOUNTCONTROLDB_SQLSERVER_HOST: z.string().min(1),
  ACCOUNTCONTROLDB_SQLSERVER_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(1433),
  ACCOUNTCONTROLDB_SQLSERVER_DATABASE: z.string().min(1),
  ACCOUNTCONTROLDB_SQLSERVER_USER: z.string().min(1),
  ACCOUNTCONTROLDB_SQLSERVER_PASSWORD: z.string().min(1),
  ACCOUNTCONTROLDB_SQLSERVER_ENCRYPT: z.coerce.boolean().default(false),
  ACCOUNTCONTROLDB_SQLSERVER_TRUST_SERVER_CERTIFICATE: z.coerce
    .boolean()
    .default(false),

  BACKUP_OUTPUT_DIR: z.string().min(1).optional(),
});

type BackupEnv = z.infer<typeof backupEnvSchema>;

function buildConnection(
  env: BackupEnv,
  prefix: "FINANCIALCONTROLDB" | "ACCOUNTCONTROLDB",
  source: SqlServerConnectionConfig["source"],
): SqlServerConnectionConfig {
  return {
    source,
    host: env[`${prefix}_SQLSERVER_HOST`],
    port: env[`${prefix}_SQLSERVER_PORT`],
    database: env[`${prefix}_SQLSERVER_DATABASE`],
    user: env[`${prefix}_SQLSERVER_USER`],
    password: env[`${prefix}_SQLSERVER_PASSWORD`],
    encrypt: env[`${prefix}_SQLSERVER_ENCRYPT`],
    trustServerCertificate: env[`${prefix}_SQLSERVER_TRUST_SERVER_CERTIFICATE`],
  };
}

async function main(): Promise<void> {
  const env = backupEnvSchema.parse(process.env);
  const outputDir = resolveBackupOutputDir(env.BACKUP_OUTPUT_DIR);

  const targets: BackupTarget[] = [
    {
      key: "financialcontroldb",
      connection: buildConnection(env, "FINANCIALCONTROLDB", "source-a"),
    },
    {
      key: "accountcontroldb",
      connection: buildConnection(env, "ACCOUNTCONTROLDB", "source-b"),
    },
  ];

  console.log(`Iniciando backup SQL Server em ${outputDir}`);
  const summary = await runSqlServerBackups(targets, outputDir);
  console.log(JSON.stringify(summary, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  console.error(`Erro ao executar backup SQL Server: ${message}`);
  process.exitCode = 1;
});

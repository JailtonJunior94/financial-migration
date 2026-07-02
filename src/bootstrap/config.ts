import { z } from "zod";

const envSchema = z.object({
  FINANCIALCONTROLDB_SQLSERVER_HOST: z.string().min(1),
  FINANCIALCONTROLDB_SQLSERVER_PORT: z.coerce.number().int().positive().default(1433),
  FINANCIALCONTROLDB_SQLSERVER_DATABASE: z.string().min(1),
  FINANCIALCONTROLDB_SQLSERVER_USER: z.string().min(1),
  FINANCIALCONTROLDB_SQLSERVER_PASSWORD: z.string().min(1),
  FINANCIALCONTROLDB_SQLSERVER_ENCRYPT: z.coerce.boolean().default(false),
  FINANCIALCONTROLDB_SQLSERVER_TRUST_SERVER_CERTIFICATE: z.coerce
    .boolean()
    .default(false),

  ACCOUNTCONTROLDB_SQLSERVER_HOST: z.string().min(1),
  ACCOUNTCONTROLDB_SQLSERVER_PORT: z.coerce.number().int().positive().default(1433),
  ACCOUNTCONTROLDB_SQLSERVER_DATABASE: z.string().min(1),
  ACCOUNTCONTROLDB_SQLSERVER_USER: z.string().min(1),
  ACCOUNTCONTROLDB_SQLSERVER_PASSWORD: z.string().min(1),
  ACCOUNTCONTROLDB_SQLSERVER_ENCRYPT: z.coerce.boolean().default(false),
  ACCOUNTCONTROLDB_SQLSERVER_TRUST_SERVER_CERTIFICATE: z.coerce
    .boolean()
    .default(false),

  TARGET_API_BASE_URL: z.string().url(),
  TARGET_API_TOKEN: z.string().min(1),
  TARGET_API_POST_PATH: z.literal("/records").default("/records"),
  TARGET_API_IDEMPOTENCY_HEADER: z.string().min(1).default("Idempotency-Key"),

  CHECKPOINT_FILE: z.string().default("./checkpoints/default.json"),
  PILOT_SELECTION_FILE: z.string().default("./tmp/pilot-selection.json"),
  OPENAPI_SPEC_PATH: z
    .string()
    .default("./openapi/target-service.openapi.json"),
});

export type AppConfig = z.infer<typeof envSchema>;

export const loadConfig = (): AppConfig => envSchema.parse(process.env);

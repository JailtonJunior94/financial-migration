import sql from "mssql";
import type { SourceSystem } from "../../domain/schema/types.ts";

export type SqlServerConnectionConfig = {
  source: SourceSystem;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
};

export class SqlServerClient {
  constructor(readonly config: SqlServerConnectionConfig) {}

  async withPool<T>(
    callback: (pool: sql.ConnectionPool) => Promise<T>,
  ): Promise<T> {
    const pool = await new sql.ConnectionPool({
      server: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      options: {
        encrypt: this.config.encrypt,
        trustServerCertificate: this.config.trustServerCertificate,
      },
    }).connect();

    try {
      return await callback(pool);
    } finally {
      await pool.close();
    }
  }
}

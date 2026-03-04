// ---------------------------------------------------------------------------
// TenantDbConnector — Connect to tenant ERP databases for cross-tenant reads
// Source: Architecture §2.31 (Platform Admin), Story E5d-3 AC#2
// ---------------------------------------------------------------------------

import pg from 'pg';

const { Client } = pg;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TenantConnectionInfo {
  dbHost: string;
  dbName: string;
  dbPort: number;
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface TenantDbClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  close(): Promise<void>;
}

/** Minimal logger interface matching Fastify's BaseLogger */
export interface ConnectorLogger {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

const defaultLogger: ConnectorLogger = {
  info: (msg, ...args) => console.log(msg, ...args),
  warn: (msg, ...args) => console.warn(msg, ...args),
  error: (msg, ...args) => console.error(msg, ...args),
};

// ---------------------------------------------------------------------------
// Connection timeout (5 seconds per AC#2)
// ---------------------------------------------------------------------------
const CONNECTION_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// TenantDbConnector
// ---------------------------------------------------------------------------

export class TenantDbConnector {
  private readonly serviceUser: string;
  private readonly servicePassword: string;
  private readonly logger: ConnectorLogger;

  constructor(logger?: ConnectorLogger) {
    this.serviceUser = process.env.TENANT_DB_SERVICE_USER ?? '';
    this.servicePassword = process.env.TENANT_DB_SERVICE_PASSWORD ?? '';
    this.logger = logger ?? defaultLogger;
  }

  /**
   * Check whether tenant DB credentials are configured.
   * Aggregation endpoints should return 503 if this is false.
   */
  isConfigured(): boolean {
    return this.serviceUser !== '' && this.servicePassword !== '';
  }

  /**
   * Connect to a tenant's ERP database using the tenant's connection info
   * and shared read-only service credentials from environment.
   *
   * Returns a TenantDbClient on success, or null on failure (graceful degradation).
   * Connection failures are logged as warnings — aggregation continues.
   */
  async connectToTenantDb(tenant: TenantConnectionInfo): Promise<TenantDbClient | null> {
    if (!this.isConfigured()) {
      this.logger.warn('Tenant DB service credentials not configured — cannot connect');
      return null;
    }

    const client = new Client({
      host: tenant.dbHost,
      port: tenant.dbPort,
      database: tenant.dbName,
      user: this.serviceUser,
      password: this.servicePassword,
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      statement_timeout: 30_000,
    });

    try {
      await client.connect();

      // Enforce read-only mode on this connection
      await client.query('SET default_transaction_read_only = true');

      this.logger.info(
        `Connected to tenant DB: ${tenant.dbHost}:${tenant.dbPort}/${tenant.dbName}`,
      );

      return this.wrapClient(client, tenant);
    } catch (err) {
      this.logger.warn(
        `Failed to connect to tenant DB ${tenant.dbHost}:${tenant.dbPort}/${tenant.dbName}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );

      // Ensure cleanup even on partial connection failure
      try {
        await client.end();
      } catch {
        // Ignore cleanup errors on a failed connection
      }

      return null;
    }
  }

  /**
   * Wrap a raw pg.Client in the TenantDbClient interface with
   * error handling and guaranteed cleanup.
   */
  private wrapClient(client: pg.Client, tenant: TenantConnectionInfo): TenantDbClient {
    let closed = false;

    return {
      query: async <T = Record<string, unknown>>(
        sql: string,
        params?: unknown[],
      ): Promise<QueryResult<T>> => {
        if (closed) {
          this.logger.error(`Query attempted on closed connection for ${tenant.dbName}`);
          return { rows: [], rowCount: 0 };
        }

        try {
          const result = await client.query(sql, params);
          return {
            rows: result.rows as T[],
            rowCount: result.rowCount ?? 0,
          };
        } catch (err) {
          this.logger.error(
            `Query failed on tenant DB ${tenant.dbName}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          return { rows: [], rowCount: 0 };
        }
      },

      close: async (): Promise<void> => {
        if (closed) return;
        closed = true;

        try {
          await client.end();
        } catch (err) {
          this.logger.warn(
            `Error closing tenant DB connection ${tenant.dbName}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      },
    };
  }
}

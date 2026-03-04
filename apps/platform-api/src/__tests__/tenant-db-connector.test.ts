// ---------------------------------------------------------------------------
// TenantDbConnector Tests — E5d-3 Task 3.3
// Source: AC#2 (Tenant DB Read Connector)
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantConnectionInfo, ConnectorLogger } from '../services/tenant-db-connector.js';

// ---------------------------------------------------------------------------
// Mock pg module
// ---------------------------------------------------------------------------

const mockConnect = vi.fn();
const mockQuery = vi.fn();
const mockEnd = vi.fn();

vi.mock('pg', () => {
  return {
    default: {
      Client: vi.fn().mockImplementation(() => ({
        connect: mockConnect,
        query: mockQuery,
        end: mockEnd,
      })),
    },
  };
});

// Import after mocking
import { TenantDbConnector } from '../services/tenant-db-connector.js';
import pg from 'pg';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TENANT_INFO: TenantConnectionInfo = {
  dbHost: 'tenant-db.example.com',
  dbName: 'tenant_acme',
  dbPort: 5432,
};

const SERVICE_USER = 'platform_reader';
const SERVICE_PASSWORD = 'reader_secret_123';

const mockLogger: ConnectorLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TenantDbConnector', () => {
  let originalUser: string | undefined;
  let originalPassword: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalUser = process.env.TENANT_DB_SERVICE_USER;
    originalPassword = process.env.TENANT_DB_SERVICE_PASSWORD;
    process.env.TENANT_DB_SERVICE_USER = SERVICE_USER;
    process.env.TENANT_DB_SERVICE_PASSWORD = SERVICE_PASSWORD;
  });

  afterEach(() => {
    if (originalUser !== undefined) {
      process.env.TENANT_DB_SERVICE_USER = originalUser;
    } else {
      delete process.env.TENANT_DB_SERVICE_USER;
    }
    if (originalPassword !== undefined) {
      process.env.TENANT_DB_SERVICE_PASSWORD = originalPassword;
    } else {
      delete process.env.TENANT_DB_SERVICE_PASSWORD;
    }
  });

  // -----------------------------------------------------------------------
  // isConfigured()
  // -----------------------------------------------------------------------

  describe('isConfigured()', () => {
    it('returns true when both env vars are set', () => {
      const connector = new TenantDbConnector(mockLogger);
      expect(connector.isConfigured()).toBe(true);
    });

    it('returns false when TENANT_DB_SERVICE_USER is missing', () => {
      delete process.env.TENANT_DB_SERVICE_USER;
      const connector = new TenantDbConnector(mockLogger);
      expect(connector.isConfigured()).toBe(false);
    });

    it('returns false when TENANT_DB_SERVICE_PASSWORD is missing', () => {
      delete process.env.TENANT_DB_SERVICE_PASSWORD;
      const connector = new TenantDbConnector(mockLogger);
      expect(connector.isConfigured()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // connectToTenantDb() — connection construction
  // -----------------------------------------------------------------------

  describe('connectToTenantDb() — connection construction', () => {
    it('creates pg.Client with correct connection params', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const connector = new TenantDbConnector(mockLogger);
      const client = await connector.connectToTenantDb(TENANT_INFO);

      expect(client).not.toBeNull();

      // Verify Client constructor was called with correct params
      expect(pg.Client).toHaveBeenCalledWith({
        host: TENANT_INFO.dbHost,
        port: TENANT_INFO.dbPort,
        database: TENANT_INFO.dbName,
        user: SERVICE_USER,
        password: SERVICE_PASSWORD,
        connectionTimeoutMillis: 5_000,
        statement_timeout: 30_000,
      });
    });

    it('sets read-only mode after connecting', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const connector = new TenantDbConnector(mockLogger);
      await connector.connectToTenantDb(TENANT_INFO);

      // First query call should set read-only mode
      expect(mockQuery).toHaveBeenCalledWith('SET default_transaction_read_only = true');
    });

    it('enforces 5-second connection timeout', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const connector = new TenantDbConnector(mockLogger);
      await connector.connectToTenantDb(TENANT_INFO);

      const constructorCall = vi.mocked(pg.Client).mock.calls[0]![0] as {
        connectionTimeoutMillis: number;
      };
      expect(constructorCall.connectionTimeoutMillis).toBe(5_000);
    });

    it('logs info message on successful connection', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const connector = new TenantDbConnector(mockLogger);
      await connector.connectToTenantDb(TENANT_INFO);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Connected to tenant DB'),
      );
    });
  });

  // -----------------------------------------------------------------------
  // connectToTenantDb() — graceful failure
  // -----------------------------------------------------------------------

  describe('connectToTenantDb() — graceful failure', () => {
    it('returns null when credentials are not configured', async () => {
      delete process.env.TENANT_DB_SERVICE_USER;
      const connector = new TenantDbConnector(mockLogger);

      const client = await connector.connectToTenantDb(TENANT_INFO);

      expect(client).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('credentials not configured'),
      );
    });

    it('returns null on connection failure with warning log', async () => {
      mockConnect.mockRejectedValue(new Error('Connection refused'));

      const connector = new TenantDbConnector(mockLogger);
      const client = await connector.connectToTenantDb(TENANT_INFO);

      expect(client).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to connect'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Connection refused'));
    });

    it('cleans up pg.Client on connection failure', async () => {
      mockConnect.mockRejectedValue(new Error('Auth failure'));
      mockEnd.mockResolvedValue(undefined);

      const connector = new TenantDbConnector(mockLogger);
      await connector.connectToTenantDb(TENANT_INFO);

      expect(mockEnd).toHaveBeenCalled();
    });

    it('handles cleanup error silently on failed connection', async () => {
      mockConnect.mockRejectedValue(new Error('Timeout'));
      mockEnd.mockRejectedValue(new Error('Already closed'));

      const connector = new TenantDbConnector(mockLogger);

      // Should not throw despite cleanup error
      const client = await connector.connectToTenantDb(TENANT_INFO);
      expect(client).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // TenantDbClient.query()
  // -----------------------------------------------------------------------

  describe('TenantDbClient.query()', () => {
    it('executes SQL and returns rows', async () => {
      const mockRows = [
        { skill_key: 'create_invoice', total_queries: 45 },
        { skill_key: 'apply_filter', total_queries: 89 },
      ];
      mockConnect.mockResolvedValue(undefined);
      // First call: SET read-only; second call: actual query
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: mockRows, rowCount: 2 });

      const connector = new TenantDbConnector(mockLogger);
      const client = await connector.connectToTenantDb(TENANT_INFO);

      const result = await client!.query(
        'SELECT skill_key, total_queries FROM ai_learning_signals WHERE signal_date = $1',
        ['2026-03-03'],
      );

      expect(result.rows).toEqual(mockRows);
      expect(result.rowCount).toBe(2);
    });

    it('returns empty result on query failure', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockRejectedValueOnce(new Error('relation does not exist'));

      const connector = new TenantDbConnector(mockLogger);
      const client = await connector.connectToTenantDb(TENANT_INFO);

      const result = await client!.query('SELECT * FROM nonexistent_table');

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Query failed'));
    });

    it('returns empty result when querying a closed connection', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      mockEnd.mockResolvedValue(undefined);

      const connector = new TenantDbConnector(mockLogger);
      const client = await connector.connectToTenantDb(TENANT_INFO);

      await client!.close();
      const result = await client!.query('SELECT 1');

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('closed connection'));
    });
  });

  // -----------------------------------------------------------------------
  // TenantDbClient.close()
  // -----------------------------------------------------------------------

  describe('TenantDbClient.close()', () => {
    it('closes the underlying pg.Client', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      mockEnd.mockResolvedValue(undefined);

      const connector = new TenantDbConnector(mockLogger);
      const client = await connector.connectToTenantDb(TENANT_INFO);

      await client!.close();

      expect(mockEnd).toHaveBeenCalled();
    });

    it('is idempotent — multiple close calls do not error', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      mockEnd.mockResolvedValue(undefined);

      const connector = new TenantDbConnector(mockLogger);
      const client = await connector.connectToTenantDb(TENANT_INFO);

      await client!.close();
      await client!.close();

      // Only called once despite two close() calls
      expect(mockEnd).toHaveBeenCalledTimes(1);
    });

    it('handles close error gracefully', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      mockEnd.mockRejectedValue(new Error('Connection already terminated'));

      const connector = new TenantDbConnector(mockLogger);
      const client = await connector.connectToTenantDb(TENANT_INFO);

      // Should not throw
      await client!.close();

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Error closing'));
    });
  });
});

import { ConnectionConfig, QueryResult, TableSchema, ColumnInfo } from '@/types/database';
import { DatabaseConnection } from './types';

export class MySQLProxyConnection implements DatabaseConnection {
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // For proxy connections, we don't maintain a persistent connection
    // Connection is established per request
  }

  async disconnect(): Promise<void> {
    // No persistent connection to close
  }

  private async getRemoteDbData(query: string, params: string[] = []): Promise<{
    data?: Record<string, unknown>[];
    result?: {
      affected_rows?: number;
      error?: string;
      [key: string]: unknown;
    };
    mysqli?: {
      affected_rows?: number;
      [key: string]: unknown;
    };
  }> {
    if (!this.config.host || !this.config.username || !this.config.password || !this.config.server) {
      throw new Error('MySQL proxy requires host, username, password, and server');
    }

    const authHeader = `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        server: this.config.server,
        db: this.config.database,
        query,
        params: params || []
      })
    };

    const response = await fetch(this.config.host, options);

    if (!response.ok) {
      console.error(response);
      throw new Error('Failed to connect to database proxy');
    }

    const data = await response.json();
    return data;
  }

  async executeQuery(query: string): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.getRemoteDbData(query);
      const executionTime = Date.now() - startTime;

      // Handle error responses
      if (result.result?.error) {
        throw new Error(result.result.error);
      }

      // For SELECT queries - data is in the 'data' array
      if (result.data && Array.isArray(result.data)) {
        const columns = result.data.length > 0 ? Object.keys(result.data[0]) : [];
        return {
          columns,
          rows: result.data as Record<string, unknown>[],
          executionTime,
        };
      }

      // For INSERT/UPDATE/DELETE queries - check result metadata
      return {
        columns: [],
        rows: [],
        affectedRows: result.result?.affected_rows || result.mysqli?.affected_rows || 0,
        executionTime,
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  async getTables(): Promise<string[]> {
    const result = await this.executeQuery('SHOW TABLES');
    return result.rows.map((row: Record<string, unknown>) => Object.values(row)[0] as string);
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    const columnsResult = await this.executeQuery(`DESCRIBE ${tableName}`);
    
    const columns: ColumnInfo[] = columnsResult.rows.map((row: Record<string, unknown>) => ({
      name: row.Field as string,
      type: row.Type as string,
      nullable: row.Null === 'YES',
      key: row.Key ? row.Key as string : undefined,
      default: row.Default,
      autoIncrement: (row.Extra as string)?.includes('auto_increment') || false,
    }));

    return {
      name: tableName,
      columns,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.executeQuery('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
} 
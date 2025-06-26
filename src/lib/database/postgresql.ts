import { Client } from 'pg';
import { ConnectionConfig, QueryResult, TableSchema, ColumnInfo } from '@/types/database';
import { DatabaseConnection } from './types';

export class PostgreSQLConnection implements DatabaseConnection {
  private client: Client | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      this.client = new Client({
        host: this.config.host,
        port: this.config.port || 5432,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
      });
      await this.client.connect();
    } catch (error) {
      throw new Error(`Failed to connect to PostgreSQL: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.client) {
      throw new Error('Not connected to database');
    }

    const startTime = Date.now();
    try {
      const result = await this.client.query(query);
      const executionTime = Date.now() - startTime;

      const columns = result.fields?.map((field: {name: string}) => field.name) || [];
      
      return {
        columns,
        rows: result.rows as Record<string, unknown>[],
        affectedRows: result.rowCount || undefined,
        executionTime,
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  async getTables(): Promise<string[]> {
    const result = await this.executeQuery(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    return result.rows.map((row: Record<string, unknown>) => row.table_name as string);
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    const columnsResult = await this.executeQuery(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = '${tableName}' 
      ORDER BY ordinal_position
    `);
    
    const columns: ColumnInfo[] = columnsResult.rows.map((row: Record<string, unknown>) => ({
      name: row.column_name,
      type: row.character_maximum_length 
        ? `${row.data_type}(${row.character_maximum_length})`
        : row.data_type,
      nullable: row.is_nullable === 'YES',
      default: row.column_default,
      autoIncrement: row.column_default?.includes('nextval') || false,
    }));

    return {
      name: tableName,
      columns,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      await this.executeQuery('SELECT 1');
      await this.disconnect();
      return true;
    } catch {
      return false;
    }
  }
} 
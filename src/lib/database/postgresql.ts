import { Client } from 'pg';
import { ConnectionConfig, QueryResult, TableSchema, ColumnInfo, TableMetadata } from '@/types/database';
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
    // Use double quotes for case-sensitive table names in PostgreSQL
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
      name: row.column_name as string,
      type: row.character_maximum_length 
        ? `${row.data_type}(${row.character_maximum_length})`
        : row.data_type as string,
      nullable: row.is_nullable === 'YES',
      default: row.column_default,
      autoIncrement: (row.column_default as string)?.includes('nextval') || false,
    }));

    return {
      name: tableName,
      columns,
    };
  }

  async getTableMetadata(tableName: string): Promise<TableMetadata> {
    try {
      // Get table size and row count from pg_stat_user_tables and pg_total_relation_size
      const metadataQuery = `
        SELECT 
          COALESCE(s.n_tup_ins + s.n_tup_upd - s.n_tup_del, 0) as row_count,
          pg_total_relation_size(c.oid) as size_bytes
        FROM pg_class c
        LEFT JOIN pg_stat_user_tables s ON c.relname = s.relname
        WHERE c.relname = '${tableName}' AND c.relkind = 'r'
      `;
      
      const result = await this.executeQuery(metadataQuery);
      
      if (result.rows.length === 0) {
        // Fallback: get row count with COUNT query
        const countResult = await this.executeQuery(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const rowCount = Number(countResult.rows[0]?.count) || 0;
        
        return {
          name: tableName,
          rowCount,
          sizeBytes: 0,
          sizeFormatted: this.formatBytes(0)
        };
      }
      
      const row = result.rows[0];
      const rowCount = Number(row.row_count) || 0;
      const sizeBytes = Number(row.size_bytes) || 0;
      
      return {
        name: tableName,
        rowCount,
        sizeBytes,
        sizeFormatted: this.formatBytes(sizeBytes)
      };
    } catch (error) {
      console.warn(`Failed to get metadata for table ${tableName}:`, error);
      // Fallback: just get row count
      try {
        const countResult = await this.executeQuery(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const rowCount = Number(countResult.rows[0]?.count) || 0;
        
        return {
          name: tableName,
          rowCount,
          sizeBytes: 0,
          sizeFormatted: 'Unknown'
        };
      } catch {
        return {
          name: tableName,
          rowCount: 0,
          sizeBytes: 0,
          sizeFormatted: 'Unknown'
        };
      }
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'kB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
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
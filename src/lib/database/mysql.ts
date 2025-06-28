import mysql from 'mysql2/promise';
import { ConnectionConfig, QueryResult, TableSchema, ColumnInfo, TableMetadata } from '@/types/database';
import { DatabaseConnection } from './types';

export class MySQLConnection implements DatabaseConnection {
  private connection: mysql.Connection | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      this.connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port || 3306,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
      });
    } catch (error) {
      throw new Error(`Failed to connect to MySQL: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }

    const startTime = Date.now();
    try {
      const [rows, fields] = await this.connection.execute(query);
      const executionTime = Date.now() - startTime;

      if (Array.isArray(rows)) {
        const columns = fields?.map((field: {name: string}) => field.name) || [];
        return {
          columns,
          rows: rows as Record<string, unknown>[],
          executionTime,
        };
      } else {
        return {
          columns: [],
          rows: [],
          affectedRows: (rows as {affectedRows: number}).affectedRows,
          executionTime,
        };
      }
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  async getTables(): Promise<string[]> {
    const result = await this.executeQuery('SHOW TABLES');
    return result.rows.map((row: Record<string, unknown>) => Object.values(row)[0] as string);
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    // Use backticks to properly quote table names for case sensitivity
    const columnsResult = await this.executeQuery(`DESCRIBE \`${tableName}\``);
    
    const columns: ColumnInfo[] = columnsResult.rows.map((row: Record<string, unknown>) => ({
      name: row.Field as string,
      type: row.Type as string,
      nullable: row.Null === 'YES',
      key: row.Key as string || undefined,
      default: row.Default,
      autoIncrement: (row.Extra as string)?.includes('auto_increment') || false,
    }));

    return {
      name: tableName,
      columns,
    };
  }

  async getTableMetadata(tableName: string): Promise<TableMetadata> {
    try {
      // Get table size and row count from information_schema
      const sizeQuery = `
        SELECT 
          table_rows as row_count,
          (data_length + index_length) as size_bytes
        FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = ?
      `;
      
      const result = await this.executeQuery(
        sizeQuery.replace(/\?/g, `'${this.config.database}', '${tableName}'`)
      );
      
      if (result.rows.length === 0) {
        // Fallback: get row count with COUNT query
        const countResult = await this.executeQuery(`SELECT COUNT(*) as count FROM \`${tableName}\``);
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
        const countResult = await this.executeQuery(`SELECT COUNT(*) as count FROM \`${tableName}\``);
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
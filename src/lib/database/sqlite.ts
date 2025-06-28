import Database from 'better-sqlite3';
import { ConnectionConfig, QueryResult, TableSchema, ColumnInfo, TableMetadata } from '@/types/database';
import { DatabaseConnection } from './types';

export class SQLiteConnection implements DatabaseConnection {
  private db: Database.Database | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      if (!this.config.filename) {
        throw new Error('SQLite filename is required');
      }
      this.db = new Database(this.config.filename);
    } catch (error) {
      throw new Error(`Failed to connect to SQLite: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.db) {
      throw new Error('Not connected to database');
    }

    const startTime = Date.now();
    try {
      const trimmedQuery = query.trim().toLowerCase();
      
      if (trimmedQuery.startsWith('select')) {
        const stmt = this.db.prepare(query);
        const rows = stmt.all();
        const executionTime = Date.now() - startTime;
        
        const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
        
        return {
          columns,
          rows: rows as Record<string, unknown>[],
          executionTime,
        };
      } else {
        this.db.exec(query);
        const executionTime = Date.now() - startTime;
        
        return {
          columns: [],
          rows: [],
          affectedRows: this.db.prepare('SELECT changes()').get() as number,
          executionTime,
        };
      }
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  async getTables(): Promise<string[]> {
    const result = await this.executeQuery(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    return result.rows.map((row: Record<string, unknown>) => row.name as string);
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    const result = await this.executeQuery(`PRAGMA table_info(${tableName})`);
    
    const columns: ColumnInfo[] = result.rows.map((row: Record<string, unknown>) => ({
      name: row.name as string,
      type: row.type as string,
      nullable: !row.notnull,
      key: row.pk ? 'PRI' : undefined,
      default: row.dflt_value,
      autoIncrement: Boolean(row.pk) && (row.type as string).toLowerCase().includes('integer'),
    }));

    return {
      name: tableName,
      columns,
    };
  }

  async getTableMetadata(tableName: string): Promise<TableMetadata> {
    try {
      // Get row count
      const countResult = await this.executeQuery(`SELECT COUNT(*) as count FROM ${tableName}`);
      const rowCount = Number(countResult.rows[0]?.count) || 0;
      
      // SQLite doesn't have built-in size calculation, so we estimate
      // by getting the page count and page size
      try {
        const pageSizeResult = await this.executeQuery(`PRAGMA page_size`);
        const pageCountResult = await this.executeQuery(`PRAGMA page_count`);
        
        const pageSize = Number(pageSizeResult.rows[0]?.page_size) || 4096;
        const pageCount = Number(pageCountResult.rows[0]?.page_count) || 0;
        const sizeBytes = pageSize * pageCount;
        
        return {
          name: tableName,
          rowCount,
          sizeBytes,
          sizeFormatted: this.formatBytes(sizeBytes)
        };
      } catch {
        // Fallback if pragma queries fail
        return {
          name: tableName,
          rowCount,
          sizeBytes: 0,
          sizeFormatted: 'Unknown'
        };
      }
    } catch (error) {
      console.warn(`Failed to get metadata for table ${tableName}:`, error);
      return {
        name: tableName,
        rowCount: 0,
        sizeBytes: 0,
        sizeFormatted: 'Unknown'
      };
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
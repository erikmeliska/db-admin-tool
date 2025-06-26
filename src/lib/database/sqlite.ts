import Database from 'better-sqlite3';
import { ConnectionConfig, QueryResult, TableSchema, ColumnInfo } from '@/types/database';
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
        
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        
        return {
          columns,
          rows,
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
      name: row.name,
      type: row.type,
      nullable: !row.notnull,
      key: row.pk ? 'PRI' : undefined,
      default: row.dflt_value,
      autoIncrement: row.pk && row.type.toLowerCase().includes('integer'),
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
export type DatabaseType = 'mysql' | 'mysql-proxy' | 'postgresql' | 'sqlite' | 'mongodb';

export interface ConnectionConfig {
  id: string;
  name: string;
  type: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  filename?: string; // for SQLite
  server?: string; // for MySQL proxy - the actual server to connect to
  proxyUrl?: string;
  mysqlServer?: string;
}

// Session-based connection for secure API calls
export interface ConnectionSession {
  sessionId: string;
  name: string;
  type: DatabaseType;
  database: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  indexes?: IndexInfo[];
  foreignKeys?: ForeignKeyInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  key?: string;
  default?: any;
  autoIncrement?: boolean;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ForeignKeyInfo {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface QueryResult {
  columns: string[];
  rows: any[];
  affectedRows?: number;
  executionTime: number;
  error?: string;
} 
import { ConnectionConfig, QueryResult, TableSchema, TableMetadata } from '@/types/database';

export interface DatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  executeQuery(query: string): Promise<QueryResult>;
  getTables(): Promise<string[]>;
  getTableSchema(tableName: string): Promise<TableSchema>;
  getTableMetadata(tableName: string): Promise<TableMetadata>;
  testConnection(): Promise<boolean>;
}

export interface DatabaseConnectionFactory {
  createConnection(config: ConnectionConfig): DatabaseConnection;
} 
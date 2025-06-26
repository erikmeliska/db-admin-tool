import { ConnectionConfig, QueryResult, TableSchema } from '@/types/database';

export interface DatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  executeQuery(query: string): Promise<QueryResult>;
  getTables(): Promise<string[]>;
  getTableSchema(tableName: string): Promise<TableSchema>;
  testConnection(): Promise<boolean>;
}

export interface DatabaseConnectionFactory {
  createConnection(config: ConnectionConfig): DatabaseConnection;
} 
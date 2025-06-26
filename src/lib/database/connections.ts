import { ConnectionConfig } from '@/types/database';
import { DatabaseConnection, DatabaseConnectionFactory } from './types';
import { MySQLConnection } from './mysql';
import { MySQLProxyConnection } from './mysql-proxy';
import { PostgreSQLConnection } from './postgresql';
import { SQLiteConnection } from './sqlite';

class DatabaseConnectionManager implements DatabaseConnectionFactory {
  createConnection(config: ConnectionConfig): DatabaseConnection {
    switch (config.type) {
      case 'mysql':
        return new MySQLConnection(config);
      case 'mysql-proxy':
        return new MySQLProxyConnection(config);
      case 'postgresql':
        return new PostgreSQLConnection(config);
      case 'sqlite':
        return new SQLiteConnection(config);
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }
}

export const connectionManager = new DatabaseConnectionManager();

// Connection storage (in a real app, use a proper database or secure storage)
const connections = new Map<string, ConnectionConfig>();

export function saveConnection(config: ConnectionConfig): void {
  connections.set(config.id, config);
  // Persist to localStorage in client-side code
  if (typeof window !== 'undefined') {
    const stored = JSON.parse(localStorage.getItem('db-connections') || '[]');
    const index = stored.findIndex((c: ConnectionConfig) => c.id === config.id);
    if (index >= 0) {
      stored[index] = config;
    } else {
      stored.push(config);
    }
    localStorage.setItem('db-connections', JSON.stringify(stored));
  }
}

export function getConnection(id: string): ConnectionConfig | undefined {
  return connections.get(id);
}

export function getAllConnections(): ConnectionConfig[] {
  return Array.from(connections.values());
}

export function deleteConnection(id: string): void {
  connections.delete(id);
  if (typeof window !== 'undefined') {
    const stored = JSON.parse(localStorage.getItem('db-connections') || '[]');
    const filtered = stored.filter((c: ConnectionConfig) => c.id !== id);
    localStorage.setItem('db-connections', JSON.stringify(filtered));
  }
}

export function loadConnectionsFromStorage(): void {
  if (typeof window !== 'undefined') {
    const stored = JSON.parse(localStorage.getItem('db-connections') || '[]');
    stored.forEach((config: ConnectionConfig) => {
      connections.set(config.id, config);
    });
  }
} 
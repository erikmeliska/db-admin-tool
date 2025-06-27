import { ConnectionConfig, ConnectionSession } from '@/types/database';
import { connectionManager } from './database/connections';
import { DatabaseConnection } from './database/types';

class SessionManager {
  private sessions = new Map<string, {
    config: ConnectionConfig;
    session: ConnectionSession;
    connection?: DatabaseConnection;
  }>();

  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  private async testConnectionSafely(connection: DatabaseConnection): Promise<void> {
    try {
      // Use testConnection method if available, otherwise try connect/disconnect
      if ('testConnection' in connection && typeof connection.testConnection === 'function') {
        // console.log('Using testConnection method');
        const isValid = await connection.testConnection();
        if (!isValid) {
          throw new Error('Connection test returned false');
        }
      } else {
        // console.log('Using connect/disconnect method');
        await connection.connect();
        // Test with a simple query
        if ('executeQuery' in connection && typeof connection.executeQuery === 'function') {
          await connection.executeQuery('SELECT 1');
        }
        await connection.disconnect();
      }
    } catch (error) {
      // Ensure connection is cleaned up
      try {
        if ('disconnect' in connection && typeof connection.disconnect === 'function') {
          await connection.disconnect();
        }
      } catch (disconnectError) {
        console.warn('Error during cleanup:', disconnectError);
      }
      throw error;
    }
  }

  async createSession(config: ConnectionConfig): Promise<ConnectionSession> {
    // console.log('Creating session for config:', { ...config, password: '[REDACTED]' });
    
    // Test connection with timeout
    const connection = connectionManager.createConnection(config);
    try {
      // console.log('Testing connection with timeout...');
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000);
      });
      
      // Race between connection test and timeout
      await Promise.race([
        this.testConnectionSafely(connection),
        timeoutPromise
      ]);
      
      // console.log('Connection test successful');
    } catch (error) {
      console.error('Connection test failed:', error);
      throw new Error(`Connection test failed: ${error}`);
    }

    const sessionId = this.generateSessionId();
    const session: ConnectionSession = {
      sessionId,
      name: config.name,
      type: config.type,
      database: config.database,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    // Store session with credentials (server-side only)
    this.sessions.set(sessionId, {
      config,
      session,
    });

    // console.log('Session created with ID:', sessionId);
    // console.log('Session stored in map, total sessions:', this.sessions.size);

    // Return session without credentials
    return session;
  }

  getSession(sessionId: string): ConnectionSession | null {
    // console.log('Getting session for ID:', sessionId);
    // console.log('Available sessions:', Array.from(this.sessions.keys()));
    
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      console.log('Session not found in map');
      return null;
    }

    // Check if session is expired
    const now = new Date();
    const expiresAt = sessionData.session.expiresAt;
    // console.log('Session expires at:', expiresAt, 'Current time:', now);
    
    if (now > expiresAt) {
      // console.log('Session expired, deleting');
      this.sessions.delete(sessionId);
      return null;
    }

    // console.log('Session found and valid');
    return sessionData.session;
  }

  async getConnection(sessionId: string) {
    // console.log('Getting connection for session:', sessionId);
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new Error('Session not found or expired');
    }

    // Check if session is expired
    if (new Date() > sessionData.session.expiresAt) {
      this.sessions.delete(sessionId);
      throw new Error('Session expired');
    }

    // Always create a fresh connection to avoid connection state issues
    // console.log('Creating fresh connection for session');
    sessionData.connection = connectionManager.createConnection(sessionData.config);

    return sessionData.connection;
  }

  async destroySession(sessionId: string): Promise<boolean> {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) return false;

    // Disconnect if connected
    if (sessionData.connection) {
      try {
        await sessionData.connection.disconnect();
      } catch (error) {
        console.warn('Error disconnecting session:', error);
      }
    }

    this.sessions.delete(sessionId);
    return true;
  }

  // Cleanup expired sessions
  cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, sessionData] of this.sessions.entries()) {
      if (now > sessionData.session.expiresAt) {
        this.destroySession(sessionId);
      }
    }
  }

  // Get all active sessions (without credentials)
  getActiveSessions(): ConnectionSession[] {
    const now = new Date();
    return Array.from(this.sessions.values())
      .filter(sessionData => now <= sessionData.session.expiresAt)
      .map(sessionData => sessionData.session);
  }
}

export const sessionManager = new SessionManager();

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  sessionManager.cleanupExpiredSessions();
}, 5 * 60 * 1000); 
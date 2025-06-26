import { ConnectionConfig, ConnectionSession } from '@/types/database';
import { connectionManager } from './database/connections';

class SessionManager {
  private sessions = new Map<string, {
    config: ConnectionConfig;
    session: ConnectionSession;
    connection?: any;
  }>();

  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  async createSession(config: ConnectionConfig): Promise<ConnectionSession> {
    // Test connection first
    const connection = connectionManager.createConnection(config);
    try {
      await connection.connect();
      await connection.disconnect();
    } catch (error) {
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

    // Return session without credentials
    return session;
  }

  getSession(sessionId: string): ConnectionSession | null {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) return null;

    // Check if session is expired
    if (new Date() > sessionData.session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return sessionData.session;
  }

  async getConnection(sessionId: string) {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new Error('Session not found or expired');
    }

    // Check if session is expired
    if (new Date() > sessionData.session.expiresAt) {
      this.sessions.delete(sessionId);
      throw new Error('Session expired');
    }

    // Reuse existing connection or create new one
    if (!sessionData.connection) {
      sessionData.connection = connectionManager.createConnection(sessionData.config);
    }

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
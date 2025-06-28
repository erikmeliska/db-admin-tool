import { ConnectionConfig, ConnectionSession, TableMetadata } from '@/types/database';
import { connectionManager } from './database/connections';
import { DatabaseConnection } from './database/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import CryptoJS from 'crypto-js';

interface StoredSessionData {
  config: ConnectionConfig;
  session: ConnectionSession;
  metadata?: Record<string, TableMetadata>;
}

class SessionManager {
  private sessions = new Map<string, {
    config: ConnectionConfig;
    session: ConnectionSession;
    connection?: DatabaseConnection;
    metadata?: Record<string, TableMetadata>;
  }>();
  
  private readonly sessionsDir = path.join(process.cwd(), 'sessions');
  private readonly encryptionKeyFile = path.join(process.cwd(), 'sessions', '.encryption-key');
  private encryptionKey: string = '';
  private initializationPromise: Promise<void>;
  private isInitialized = false;

  constructor() {
    this.initializationPromise = this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    try {
      await this.ensureSessionsDir();
      await this.ensureEncryptionKey();
      await this.loadExistingSessions();
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing SessionManager:', error);
      this.isInitialized = true; // Set to true to prevent blocking
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializationPromise;
    }
  }

  private async ensureSessionsDir(): Promise<void> {
    try {
      await fs.access(this.sessionsDir);
    } catch {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    }
  }

  private async ensureEncryptionKey(): Promise<void> {
    // Check if we have an environment variable first (for backward compatibility)
    if (process.env.SESSION_ENCRYPTION_KEY) {
      this.encryptionKey = process.env.SESSION_ENCRYPTION_KEY;
      console.log('Using encryption key from environment variable');
      return;
    }

    try {
      // Try to load existing key from file
      const existingKey = await fs.readFile(this.encryptionKeyFile, 'utf8');
      this.encryptionKey = existingKey.trim();
      console.log('Loaded existing encryption key from file');
    } catch {
      // Generate new key if file doesn't exist
      this.encryptionKey = crypto.randomBytes(32).toString('hex');
      try {
        await fs.writeFile(this.encryptionKeyFile, this.encryptionKey, { mode: 0o600 });
        console.log('Generated new encryption key and saved to file');
      } catch (writeError) {
        console.warn('Could not save encryption key to file:', writeError);
        console.log('Using generated key for this session only');
      }
    }
  }

  private encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
  }

  private decrypt(encryptedText: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.enc`);
  }

  private async saveSessionToDisk(sessionId: string, data: StoredSessionData): Promise<void> {
    try {
      const encryptedData = this.encrypt(JSON.stringify(data));
      await fs.writeFile(this.getSessionFilePath(sessionId), encryptedData, 'utf8');
    } catch (error) {
      console.error('Error saving session to disk:', error);
    }
  }

  private async loadSessionFromDisk(sessionId: string): Promise<StoredSessionData | null> {
    try {
      const encryptedData = await fs.readFile(this.getSessionFilePath(sessionId), 'utf8');
      const decryptedData = this.decrypt(encryptedData);
      return JSON.parse(decryptedData);
    } catch (error) {
      console.warn('Error loading session from disk:', error);
      return null;
    }
  }

  private async deleteSessionFromDisk(sessionId: string): Promise<void> {
    try {
      await fs.unlink(this.getSessionFilePath(sessionId));
    } catch (error) {
      // File might not exist, which is fine
      console.warn('Error deleting session file:', error);
    }
  }

  private async loadExistingSessions(): Promise<void> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessionFiles = files.filter(f => f.endsWith('.enc'));
      
      for (const file of sessionFiles) {
        const sessionId = file.replace('.enc', '');
        const sessionData = await this.loadSessionFromDisk(sessionId);
        
        if (sessionData) {
          // Check if session is still valid
          const now = new Date();
          const expiresAt = new Date(sessionData.session.expiresAt);
          
          if (now <= expiresAt) {
            this.sessions.set(sessionId, {
              ...sessionData,
              connection: undefined, // Don't restore connections
              metadata: sessionData.metadata || undefined
            });
          } else {
            // Delete expired session file
            await this.deleteSessionFromDisk(sessionId);
          }
        }
      }
      
      console.log(`Loaded ${this.sessions.size} active sessions from disk`);
    } catch (error) {
      console.warn('Error loading sessions from disk:', error);
    }
  }

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
    const sessionData = {
      config,
      session,
    };
    
    this.sessions.set(sessionId, {
      ...sessionData,
      connection: undefined,
      metadata: undefined, // Will be loaded on first request
    });

    // Save to encrypted file
    await this.saveSessionToDisk(sessionId, sessionData);

    // console.log('Session created with ID:', sessionId);
    // console.log('Session stored in map, total sessions:', this.sessions.size);

    // Return session without credentials
    return session;
  }

  async getSession(sessionId: string): Promise<ConnectionSession | null> {
    await this.ensureInitialized();
    
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
      await this.deleteSessionFromDisk(sessionId);
      return null;
    }

    // console.log('Session found and valid');
    return sessionData.session;
  }

  async getConnection(sessionId: string) {
    await this.ensureInitialized();
    
    // console.log('Getting connection for session:', sessionId);
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new Error('Session not found or expired');
    }

    // Check if session is expired
    if (new Date() > sessionData.session.expiresAt) {
      this.sessions.delete(sessionId);
      await this.deleteSessionFromDisk(sessionId);
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

    // Remove from memory and disk
    this.sessions.delete(sessionId);
    await this.deleteSessionFromDisk(sessionId);
    
    return true;
  }

  // Cleanup expired sessions
  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions: string[] = [];
    
    for (const [sessionId, sessionData] of this.sessions.entries()) {
      if (now > sessionData.session.expiresAt) {
        expiredSessions.push(sessionId);
      }
    }
    
    // Clean up expired sessions
    for (const sessionId of expiredSessions) {
      await this.destroySession(sessionId);
    }
    
    // Also scan disk for any orphaned files
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessionFiles = files.filter(f => f.endsWith('.enc'));
      
      for (const file of sessionFiles) {
        const sessionId = file.replace('.enc', '');
        if (!this.sessions.has(sessionId)) {
          // Check if the file contains an expired session
          const sessionData = await this.loadSessionFromDisk(sessionId);
          if (sessionData) {
            const expiresAt = new Date(sessionData.session.expiresAt);
            if (now > expiresAt) {
              await this.deleteSessionFromDisk(sessionId);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error during disk cleanup:', error);
    }
  }

  // Get all active sessions (without credentials)
  async getActiveSessions(): Promise<ConnectionSession[]> {
    await this.ensureInitialized();
    
    const now = new Date();
    return Array.from(this.sessions.values())
      .filter(sessionData => now < new Date(sessionData.session.expiresAt))
      .map(sessionData => sessionData.session);
  }

  // Get cached table metadata for a session
  async getTableMetadata(sessionId: string): Promise<Record<string, TableMetadata> | null> {
    await this.ensureInitialized();
    
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      return null;
    }

    return sessionData.metadata || null;
  }

  // Refresh table metadata for a session
  async refreshTableMetadata(sessionId: string): Promise<Record<string, TableMetadata>> {
    await this.ensureInitialized();
    
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    // Check if session is expired
    if (new Date() > sessionData.session.expiresAt) {
      this.sessions.delete(sessionId);
      await this.deleteSessionFromDisk(sessionId);
      throw new Error('Session expired');
    }

    const connection = connectionManager.createConnection(sessionData.config);
    
    try {
      await connection.connect();
      
      // Get all tables
      const tables = await connection.getTables();
      const metadata: Record<string, TableMetadata> = {};
      
      // Get metadata for each table
      for (const tableName of tables) {
        try {
          metadata[tableName] = await connection.getTableMetadata(tableName);
        } catch (error) {
          console.warn(`Failed to get metadata for table ${tableName}:`, error);
          // Add fallback metadata
          metadata[tableName] = {
            name: tableName,
            rowCount: 0,
            sizeBytes: 0,
            sizeFormatted: 'Unknown'
          };
        }
      }
      
      await connection.disconnect();
      
      // Update session data
      sessionData.metadata = metadata;
      
      // Save to disk
      await this.saveSessionToDisk(sessionId, {
        config: sessionData.config,
        session: sessionData.session,
        metadata
      });
      
      return metadata;
    } catch (error) {
      try {
        await connection.disconnect();
      } catch (disconnectError) {
        console.warn('Error during disconnect:', disconnectError);
      }
      throw new Error(`Failed to refresh table metadata: ${error}`);
    }
  }
}

export const sessionManager = new SessionManager();

// Cleanup expired sessions every 5 minutes
setInterval(async () => {
  await sessionManager.cleanupExpiredSessions();
}, 5 * 60 * 1000); 
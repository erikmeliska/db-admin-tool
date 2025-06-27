'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ConnectionConfig, ConnectionSession, DatabaseType } from '@/types/database';
import { Database, Plus, Trash2, Clock, Shield } from 'lucide-react';

interface SecureConnectionManagerProps {
  onSessionSelect: (session: ConnectionSession | null) => void;
  selectedSession?: ConnectionSession | null;
}

export function SecureConnectionManager({ onSessionSelect, selectedSession }: SecureConnectionManagerProps) {
  const [sessions, setSessions] = useState<ConnectionSession[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<ConnectionConfig>>({
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    database: '',
    username: '',
    password: '',
    name: '',
    server: '',
  });

  // Default ports for different database types
  const getDefaultPort = (dbType: DatabaseType): number => {
    switch (dbType) {
      case 'mysql':
        return 3306;
      case 'mysql-proxy':
        return 0; // MySQL proxy doesn't use traditional ports
      case 'postgresql':
        return 5432;
      case 'sqlite':
        return 0; // SQLite doesn't use ports
      default:
        return 3306;
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const createSession = async () => {
    if (!formData.name || !formData.type || !formData.database) {
      alert('Please fill in all required fields');
      return;
    }

    // Additional validation for MySQL proxy
    if (formData.type === 'mysql-proxy') {
      if (!formData.host || !formData.server || !formData.username || !formData.password) {
        alert('MySQL Proxy requires Proxy URL, MySQL Server, Username, and Password');
        return;
      }
    }

    // console.log('Creating session with data:', { ...formData, password: '[REDACTED]' });
    setIsLoading(true);
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          id: crypto.randomUUID(),
        }),
      });

      // console.log('Session creation response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        // console.log('Session created successfully:', data.session);
        setSessions(prev => [...prev, data.session]);
        setShowAddForm(false);
        setFormData({
          type: 'mysql',
          host: 'localhost',
          port: 3306,
          database: '',
          username: '',
          password: '',
          name: '',
          server: '',
        });
        onSessionSelect(data.session);
      } else {
        const error = await response.json();
        console.error('Session creation failed:', error);
        alert(`Failed to create session: ${error.error}`);
      }
    } catch (error) {
      console.error('Network error during session creation:', error);
      alert(`Network error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionId}`,
        },
      });

      if (response.ok) {
        setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
        if (selectedSession?.sessionId === sessionId) {
          onSessionSelect(null);
        }
      } else {
        const error = await response.json();
        alert(`Failed to delete session: ${error.error}`);
      }
    } catch (error) {
      alert(`Network error: ${error}`);
    }
  };

  const formatTimeRemaining = (expiresAt: Date) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Secure Database Sessions</span>
          </CardTitle>
          <Button onClick={() => setShowAddForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No active sessions</p>
            <p className="text-sm">Create a secure session to connect to your database</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.sessionId}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedSession?.sessionId === session.sessionId
                    ? 'bg-primary/10 border-primary'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => onSessionSelect(session)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Database className="w-5 h-5" />
                    <div>
                      <div className="font-medium">{session.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {session.type} • {session.database}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{formatTimeRemaining(session.expiresAt)}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {session.type}
                    </Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Session</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this session? This will disconnect from the database
                            and you'll need to create a new session to reconnect.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteSession(session.sessionId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Session Name</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Database"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Database Type</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value: DatabaseType) => {
                      const defaultPort = getDefaultPort(value);
                      setFormData(prev => ({ 
                        ...prev, 
                        type: value,
                        port: defaultPort 
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mysql">MySQL (Port 3306)</SelectItem>
                      <SelectItem value="postgresql">PostgreSQL (Port 5432)</SelectItem>
                      <SelectItem value="sqlite">SQLite (No Port)</SelectItem>
                      <SelectItem value="mysql-proxy">MySQL Proxy (No Port)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.type === 'sqlite' ? (
                <div>
                  <Label htmlFor="filename">Database File</Label>
                  <Input
                    id="filename"
                    value={formData.filename || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, filename: e.target.value }))}
                    placeholder="/path/to/database.db"
                  />
                </div>
              ) : formData.type === 'mysql-proxy' ? (
                <>
                  <div>
                    <Label htmlFor="host">Proxy URL</Label>
                    <Input
                      id="host"
                      value={formData.host || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
                      placeholder="https://your-proxy-api.com/query"
                    />
                  </div>
                  <div>
                    <Label htmlFor="server">MySQL Server</Label>
                    <Input
                      id="server"
                      value={formData.server || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, server: e.target.value }))}
                      placeholder="mysql-server-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="database">Database Name</Label>
                      <Input
                        id="database"
                        value={formData.database || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, database: e.target.value }))}
                        placeholder="database_name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={formData.username || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="username"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="password"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="host">Host</Label>
                      <Input
                        id="host"
                        value={formData.host || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
                        placeholder="localhost"
                      />
                    </div>
                    <div>
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        type="number"
                        value={formData.port || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || undefined }))}
                        placeholder={getDefaultPort(formData.type || 'mysql').toString()}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="database">Database Name</Label>
                    <Input
                      id="database"
                      value={formData.database || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, database: e.target.value }))}
                      placeholder="database_name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={formData.username || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="username"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="password"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex space-x-2">
                <Button onClick={createSession} disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Create Session'}
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowAddForm(false);
                  setFormData({
                    type: 'mysql',
                    host: 'localhost',
                    port: 3306,
                    database: '',
                    username: '',
                    password: '',
                    name: '',
                    server: '',
                  });
                }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded border">
          <div className="flex items-center space-x-1 mb-1">
            <Shield className="w-3 h-3" />
            <span className="font-medium">Security Note:</span>
          </div>
          <p>
            Sessions expire after 24 hours. Database credentials are stored securely on the server
            and never transmitted with queries. Only session tokens are used for API calls.
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 
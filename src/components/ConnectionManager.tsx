'use client';

import { useState, useEffect } from 'react';
import { ConnectionConfig, DatabaseType } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Database, Trash2, TestTube, Check, X } from 'lucide-react';

interface ConnectionManagerProps {
  onConnectionSelect: (connection: ConnectionConfig) => void;
  selectedConnection?: ConnectionConfig;
}

export function ConnectionManager({ onConnectionSelect, selectedConnection }: ConnectionManagerProps) {
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [newConnection, setNewConnection] = useState<Partial<ConnectionConfig>>({
    type: 'mysql',
    port: 3306,
  });

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = () => {
    const stored = localStorage.getItem('db-connections');
    if (stored) {
      setConnections(JSON.parse(stored));
    }
  };

  const saveConnection = (connection: ConnectionConfig) => {
    const updated = [...connections, connection];
    setConnections(updated);
    localStorage.setItem('db-connections', JSON.stringify(updated));
  };

  const deleteConnection = (id: string) => {
    const updated = connections.filter(c => c.id !== id);
    setConnections(updated);
    localStorage.setItem('db-connections', JSON.stringify(updated));
  };

  const testConnection = async (connection: ConnectionConfig) => {
    setTestingConnection(connection.id);
    try {
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connection),
      });
      
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Test failed:', error);
      return false;
    } finally {
      setTestingConnection(null);
    }
  };

  const handleSaveNew = () => {
    if (!newConnection.name || !newConnection.database) return;
    
    // Additional validation for MySQL proxy
    if (newConnection.type === 'mysql-proxy' && !newConnection.server) {
      alert('MySQL Server is required for proxy connections');
      return;
    }
    
    const connection: ConnectionConfig = {
      id: Date.now().toString(),
      name: newConnection.name,
      type: newConnection.type as DatabaseType,
      host: newConnection.host,
      port: newConnection.port,
      database: newConnection.database,
      username: newConnection.username,
      password: newConnection.password,
      filename: newConnection.filename,
      server: newConnection.server,
    };
    
    saveConnection(connection);
    setNewConnection({ type: 'mysql', port: 3306 });
    setIsAddingNew(false);
  };

  const getDefaultPort = (type: DatabaseType) => {
    switch (type) {
      case 'mysql': return 3306;
      case 'mysql-proxy': return 443;
      case 'postgresql': return 5432;
      case 'sqlite': return undefined;
      case 'mongodb': return 27017;
      default: return undefined;
    }
  };

  const handleTypeChange = (type: DatabaseType) => {
    setNewConnection(prev => ({
      ...prev,
      type,
      port: getDefaultPort(type),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Database Connections</h2>
        <Button onClick={() => setIsAddingNew(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Connection
        </Button>
      </div>

      {/* Connection List */}
      <div className="space-y-2">
        {connections.map((connection) => (
          <Card 
            key={connection.id}
            className={`cursor-pointer transition-colors ${
              selectedConnection?.id === connection.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => onConnectionSelect(connection)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Database className="w-5 h-5 text-gray-500" />
                  <div>
                    <div className="font-medium">{connection.name}</div>
                    <div className="text-sm text-gray-500">
                      {connection.type} • {connection.database}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{connection.type}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      testConnection(connection);
                    }}
                    disabled={testingConnection === connection.id}
                  >
                    <TestTube className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Connection</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{connection.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteConnection(connection.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add New Connection Dialog */}
      {isAddingNew && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Connection Name</Label>
                <Input
                  id="name"
                  value={newConnection.name || ''}
                  onChange={(e) => setNewConnection(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Database"
                />
              </div>
              <div>
                <Label htmlFor="type">Database Type</Label>
                <Select value={newConnection.type} onValueChange={handleTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="mysql-proxy">MySQL Proxy</SelectItem>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="sqlite">SQLite</SelectItem>
                    <SelectItem value="mongodb">MongoDB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newConnection.type !== 'sqlite' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="host">
                    {newConnection.type === 'mysql-proxy' ? 'Proxy URL' : 'Host'}
                  </Label>
                  <Input
                    id="host"
                    value={newConnection.host || ''}
                    onChange={(e) => setNewConnection(prev => ({ ...prev, host: e.target.value }))}
                    placeholder={newConnection.type === 'mysql-proxy' ? 'https://api.imservice99.eu/dbproxy/' : 'localhost'}
                  />
                </div>
                <div>
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={newConnection.port || ''}
                    onChange={(e) => setNewConnection(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                    disabled={newConnection.type === 'mysql-proxy'}
                  />
                </div>
              </div>
            )}

            {newConnection.type === 'mysql-proxy' && (
              <div>
                <Label htmlFor="server">MySQL Server</Label>
                <Input
                  id="server"
                  value={newConnection.server || ''}
                  onChange={(e) => setNewConnection(prev => ({ ...prev, server: e.target.value }))}
                  placeholder="mysql.example.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The actual MySQL server to connect to through the proxy
                </p>
              </div>
            )}

            {newConnection.type === 'sqlite' ? (
              <div>
                <Label htmlFor="filename">Database File</Label>
                <Input
                  id="filename"
                  value={newConnection.filename || ''}
                  onChange={(e) => setNewConnection(prev => ({ ...prev, filename: e.target.value }))}
                  placeholder="/path/to/database.db"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="database">Database Name</Label>
                <Input
                  id="database"
                  value={newConnection.database || ''}
                  onChange={(e) => setNewConnection(prev => ({ ...prev, database: e.target.value }))}
                  placeholder="my_database"
                />
              </div>
            )}

            {newConnection.type !== 'sqlite' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">
                    {newConnection.type === 'mysql-proxy' ? 'Proxy Username' : 'Username'}
                  </Label>
                  <Input
                    id="username"
                    value={newConnection.username || ''}
                    onChange={(e) => setNewConnection(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="user"
                  />
                </div>
                <div>
                  <Label htmlFor="password">
                    {newConnection.type === 'mysql-proxy' ? 'Proxy Password' : 'Password'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={newConnection.password || ''}
                    onChange={(e) => setNewConnection(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="password"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsAddingNew(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveNew}>
                Save Connection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 
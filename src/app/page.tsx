'use client';

import { useState, useEffect } from 'react';
import { ConnectionSession, TableSchema, QueryResult } from '@/types/database';
import { SecureConnectionManager } from '@/components/SecureConnectionManager';
import { DatabaseExplorer } from '@/components/DatabaseExplorer';
import { QueryEditor } from '@/components/QueryEditor';
import { LLMQueryGenerator } from '@/components/LLMQueryGenerator';
import { ThemeToggle } from '@/components/ThemeToggle';
import { QueryHistory } from '@/components/QueryHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Database, Code, Brain, Settings, History } from 'lucide-react';

export default function Dashboard() {
  const [selectedSession, setSelectedSession] = useState<ConnectionSession | null>(null);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [tableSchemas, setTableSchemas] = useState<Record<string, TableSchema>>({});
  const [queryToExecute, setQueryToExecute] = useState('');
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [activeTab, setActiveTab] = useState('query');

  useEffect(() => {
    if (selectedSession) {
      loadTables();
    }
  }, [selectedSession]);

  const loadTables = async () => {
    if (!selectedSession) return;

    try {
      const response = await fetch('/api/query?action=tables', {
        headers: {
          'Authorization': `Bearer ${selectedSession.sessionId}`
        }
      });
      const result = await response.json();
      
      if (result.tables) {
        setAvailableTables(result.tables);
        // Load schemas for all tables
        await loadTableSchemas(result.tables);
      }
    } catch (error) {
      console.error('Failed to load tables:', error);
    }
  };

  const loadTableSchemas = async (tables: string[]) => {
    if (!selectedSession) return;

    console.log('Loading schemas for tables:', tables);
    setLoadingSchemas(true);

    try {
      const schemas: Record<string, TableSchema> = {};
      
      // Load schema for each table
      for (const tableName of tables) {
        try {
          console.log(`Loading schema for table: ${tableName}`);
          const response = await fetch(`/api/query?action=schema&table=${tableName}`, {
            headers: {
              'Authorization': `Bearer ${selectedSession.sessionId}`
            }
          });
          const result = await response.json();
          
          console.log(`Schema result for ${tableName}:`, result);
          
          if (result.schema) {
            schemas[tableName] = result.schema;
            console.log(`Added schema for ${tableName}:`, result.schema);
          } else {
            console.warn(`No schema returned for table ${tableName}`);
          }
        } catch (error) {
          console.error(`Failed to load schema for table ${tableName}:`, error);
        }
      }
      
      console.log('Final schemas object:', schemas);
      setTableSchemas(schemas);
    } catch (error) {
      console.error('Failed to load table schemas:', error);
    } finally {
      setLoadingSchemas(false);
    }
  };

  const handleTableSelect = (tableName: string, schema: TableSchema) => {
    setTableSchemas(prev => ({ ...prev, [tableName]: schema }));
    // Generate a simple SELECT query for the selected table
    setQueryToExecute(`SELECT * FROM ${tableName} LIMIT 10;`);
  };

  const handleQueryGenerated = (query: string) => {
    setQueryToExecute(query);
  };

  const handleUseQuery = (query: string) => {
    setQueryToExecute(query);
    setActiveTab('query');
  };

  const handleQueryExecuted = (query: string, result: QueryResult) => {
    console.log('Query executed:', query, result);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Database className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Database Admin Tool</h1>
              <p className="text-sm text-muted-foreground">Modern database management with AI assistance</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {selectedSession && (
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="flex items-center space-x-1">
                  <Database className="w-3 h-3" />
                  <span>{selectedSession.name}</span>
                </Badge>
                <Badge variant="secondary">{selectedSession.type}</Badge>
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-80 flex-shrink-0 bg-card border-r border-border h-[calc(100vh-81px)] overflow-y-auto">
          <div className="p-4 lg:p-6">
            <Tabs defaultValue="connections" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="connections" className="flex items-center space-x-2">
                  <Settings className="w-4 h-4" />
                  <span>Connections</span>
                </TabsTrigger>
                <TabsTrigger value="explorer" className="flex items-center space-x-2">
                  <Database className="w-4 h-4" />
                  <span>Explorer</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="connections" className="mt-4">
                <SecureConnectionManager 
                  onSessionSelect={setSelectedSession}
                  selectedSession={selectedSession}
                />
              </TabsContent>
              
              <TabsContent value="explorer" className="mt-4">
                {selectedSession ? (
                  <DatabaseExplorer 
                    session={selectedSession}
                    onTableSelect={handleTableSelect}
                  />
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Create a secure session to explore the database</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 space-y-4 lg:space-y-6">
          {selectedSession ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-full space-y-4 lg:space-y-6">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="query" className="flex items-center space-x-2 flex-1 sm:flex-none">
                  <Code className="w-4 h-4" />
                  <span>Query Editor</span>
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex items-center space-x-2 flex-1 sm:flex-none">
                  <Brain className="w-4 h-4" />
                  <span>AI Generator</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center space-x-2 flex-1 sm:flex-none">
                  <History className="w-4 h-4" />
                  <span>History</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="query" className="w-full">
                <QueryEditor 
                  session={selectedSession}
                  onQueryExecute={handleQueryExecuted}
                  initialQuery={queryToExecute}
                  availableTables={availableTables}
                  tableSchemas={tableSchemas}
                />
              </TabsContent>
              
              <TabsContent value="ai" className="w-full">
                {loadingSchemas ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-muted-foreground">Loading table schemas...</p>
                    </CardContent>
                  </Card>
                ) : (
                  <LLMQueryGenerator 
                    session={selectedSession}
                    availableTables={availableTables}
                    tableSchemas={tableSchemas}
                    onQueryGenerated={handleQueryGenerated}
                    onUseQuery={handleUseQuery}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="history" className="w-full">
                <QueryHistory 
                  onQuerySelect={(query) => {
                    setQueryToExecute(query);
                    setActiveTab('query');
                  }}
                  onAIPromptSelect={(_prompt, _tables) => {
                    // Switch to AI tab and pre-fill the prompt
                    setActiveTab('ai');
                    // Note: We'd need to expose methods to set prompt and tables in LLMQueryGenerator
                  }}
                  currentSession={selectedSession}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="w-6 h-6" />
                  <span>Welcome to Database Admin Tool</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Get started by creating a database connection from the sidebar. This tool supports:
                </p>
                                 <div className="grid grid-cols-2 gap-4">
                   <div className="flex items-center space-x-2">
                     <Badge variant="outline">MySQL</Badge>
                     <span className="text-sm">Direct & Proxy support</span>
                   </div>
                   <div className="flex items-center space-x-2">
                     <Badge variant="outline">PostgreSQL</Badge>
                     <span className="text-sm">Full featured support</span>
                   </div>
                   <div className="flex items-center space-x-2">
                     <Badge variant="outline">SQLite</Badge>
                     <span className="text-sm">Local database files</span>
                   </div>
                   <div className="flex items-center space-x-2">
                     <Badge variant="outline">AI Powered</Badge>
                     <span className="text-sm">Natural language queries</span>
                   </div>
                 </div>
                
                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <h3 className="font-semibold text-foreground mb-2">Key Features:</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Visual database schema exploration</li>
                    <li>• Advanced SQL query editor with syntax highlighting</li>
                    <li>• AI-powered query generation from natural language</li>
                    <li>• Query history and result export</li>
                    <li>• Multiple database connections</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

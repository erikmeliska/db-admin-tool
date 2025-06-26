'use client';

import { useState, useCallback, useEffect } from 'react';
import { ConnectionSession, QueryResult } from '@/types/database';
import { queryHistoryManager } from '@/lib/query-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion } from '@codemirror/autocomplete';
import { createSQLCompletion } from '@/lib/sql-completions';
import { Play, Save, History, Clock, Database } from 'lucide-react';

interface QueryTab {
  id: string;
  title: string;
  query: string;
  result?: QueryResult;
  isExecuting?: boolean;
}

interface QueryEditorProps {
  session?: ConnectionSession;
  onQueryExecute?: (query: string, result: QueryResult) => void;
  initialQuery?: string;
  availableTables?: string[];
  tableSchemas?: Record<string, any>;
}

export function QueryEditor({ session, onQueryExecute, initialQuery = '', availableTables = [], tableSchemas = {} }: QueryEditorProps) {
  const [tabs, setTabs] = useState<QueryTab[]>([
    { id: '1', title: 'Query 1', query: initialQuery }
  ]);
  const [activeTab, setActiveTab] = useState('1');
  const [queryHistory, setQueryHistory] = useState<Array<{ query: string; timestamp: Date; executionTime: number }>>([]);

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  // Handle initialQuery updates and auto-execute
  useEffect(() => {
    if (initialQuery && initialQuery.trim() && initialQuery !== activeTabData?.query) {
      // Update the active tab with the new query
      setTabs(prev => prev.map(tab => 
        tab.id === activeTab ? { ...tab, query: initialQuery } : tab
      ));
      
      // Auto-execute the query after a brief delay to ensure the query is set
      if (session) {
        setTimeout(async () => {
          try {
            const response = await fetch('/api/query', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.sessionId}`
              },
              body: JSON.stringify({
                query: initialQuery,
              }),
            });

            const result: QueryResult = await response.json();
            
            if (response.ok) {
              setTabs(prev => prev.map(tab => 
                tab.id === activeTab ? { ...tab, result, isExecuting: false } : tab
              ));
              
              // Add to history
              setQueryHistory(prev => [
                {
                  query: initialQuery,
                  timestamp: new Date(),
                  executionTime: result.executionTime,
                },
                ...prev.slice(0, 49)
              ]);

                             if (onQueryExecute) {
                 onQueryExecute(initialQuery, result);
               }

               // Add to persistent history for auto-executed queries
               if (session) {
                 queryHistoryManager.addQueryToHistory({
                   type: 'ai-generated',
                   query: initialQuery,
                   result,
                   executionTime: result.executionTime,
                   connection: {
                     name: session.name,
                     type: session.type,
                     database: session.database,
                   },
                 });
               }
            }
          } catch (error) {
            console.error('Auto-execute failed:', error);
          }
        }, 200);
      }
    }
  }, [initialQuery, session, activeTab, onQueryExecute]);

  const updateActiveTab = useCallback((updates: Partial<QueryTab>) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTab ? { ...tab, ...updates } : tab
    ));
  }, [activeTab]);

  const executeQuery = async () => {
    if (!session || !activeTabData?.query.trim()) return;

    updateActiveTab({ isExecuting: true, result: undefined });

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionId}`
        },
        body: JSON.stringify({
          query: activeTabData.query,
        }),
      });

      const result: QueryResult = await response.json();
      
      if (response.ok) {
        updateActiveTab({ result, isExecuting: false });
        
        // Add to history
        setQueryHistory(prev => [
          {
            query: activeTabData.query,
            timestamp: new Date(),
            executionTime: result.executionTime,
          },
          ...prev.slice(0, 49) // Keep last 50 queries
        ]);

        // Add to persistent history
        if (session) {
          queryHistoryManager.addQueryToHistory({
            type: 'sql',
            query: activeTabData.query,
            result,
            executionTime: result.executionTime,
            connection: {
              name: session.name,
              type: session.type,
              database: session.database,
            },
          });
        }

        if (onQueryExecute) {
          onQueryExecute(activeTabData.query, result);
        }
      } else {
        updateActiveTab({ 
          isExecuting: false,
          result: {
            columns: [],
            rows: [],
            executionTime: 0,
            error: result.error || 'Query execution failed'
          } as any
        });
      }
    } catch (error) {
      updateActiveTab({ 
        isExecuting: false,
        result: {
          columns: [],
          rows: [],
          executionTime: 0,
          error: `Network error: ${error}`
        } as any
      });
    }
  };

  const addNewTab = () => {
    const newId = (Math.max(...tabs.map(t => parseInt(t.id))) + 1).toString();
    const newTab: QueryTab = {
      id: newId,
      title: `Query ${newId}`,
      query: '',
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTab(newId);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return; // Don't close the last tab
    
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    
    if (activeTab === tabId) {
      setActiveTab(newTabs[0].id);
    }
  };

  const saveQuery = () => {
    if (!activeTabData?.query.trim()) return;
    
    const blob = new Blob([activeTabData.query], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTabData.title.toLowerCase().replace(/\s+/g, '_')}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

    return (
    <div className="w-full max-w-full space-y-4">
      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center space-x-2 min-w-0">
              <Database className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">SQL Query Editor</span>
              {session && (
                <Badge variant="outline" className="hidden sm:inline-flex">{session.name}</Badge>
              )}
            </CardTitle>
            <div className="flex space-x-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={saveQuery}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button 
                onClick={executeQuery} 
                disabled={!session || activeTabData?.isExecuting}
                size="sm"
              >
                <Play className="w-4 h-4 mr-2" />
                {activeTabData?.isExecuting ? 'Executing...' : 'Execute'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 px-6 sm:px-0">
              <div className="overflow-x-auto">
                <TabsList className="w-max">
                  {tabs.map(tab => (
                    <TabsTrigger key={tab.id} value={tab.id} className="relative whitespace-nowrap">
                      <span className="truncate max-w-[120px]">{tab.title}</span>
                      {tabs.length > 1 && (
                        <button
                          className="ml-2 text-muted-foreground hover:text-foreground flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab.id);
                          }}
                        >
                          ×
                        </button>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <Button variant="outline" size="sm" onClick={addNewTab} className="mt-2 sm:mt-0 self-start">
                + New Tab
              </Button>
            </div>

            {tabs.map(tab => (
              <TabsContent key={tab.id} value={tab.id} className="px-6 sm:px-0">
                <div className="space-y-4 w-full">
                  <div className="border rounded-lg overflow-hidden w-full">
                    <CodeMirror
                      value={tab.query}
                      height="300px"
                      extensions={[
                        sql(),
                        autocompletion({
                          override: [
                            createSQLCompletion({
                              tables: availableTables,
                              schemas: tableSchemas
                            })
                          ]
                        })
                      ]}
                      theme={oneDark}
                      onChange={(value) => {
                        setTabs(prev => prev.map(t => 
                          t.id === tab.id ? { ...t, query: value } : t
                        ));
                      }}
                      placeholder="Enter your SQL query here..."
                      style={{ maxWidth: '100%' }}
                    />
                  </div>

                                    {tab.result && (
                    <Card className="w-full">
                      <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <CardTitle className="text-lg">Query Results</CardTitle>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>{formatExecutionTime(tab.result.executionTime)}</span>
                            </div>
                            {tab.result.affectedRows !== undefined && (
                              <span>{tab.result.affectedRows} rows affected</span>
                            )}
                            {tab.result.rows.length > 0 && (
                              <span>{tab.result.rows.length} rows returned</span>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 sm:p-6">
                                                 {(tab.result as any).error ? (
                           <div className="text-destructive bg-destructive/10 p-4 rounded border border-destructive/20">
                             <strong>Error:</strong> {(tab.result as any).error}
                           </div>
                                                 ) : tab.result.rows.length > 0 ? (
                           <div className="w-full overflow-x-auto border rounded-lg">
                             <div className="max-h-96 overflow-y-auto">
                               <table className="w-full text-sm">
                                 <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                                   <tr>
                                     {tab.result.columns.map((column, index) => (
                                       <th key={index} className="px-3 py-2 text-left font-medium border-b border-border whitespace-nowrap">
                                         {column}
                                       </th>
                                     ))}
                                   </tr>
                                 </thead>
                                 <tbody>
                                   {tab.result.rows.map((row, rowIndex) => (
                                     <tr key={rowIndex} className="hover:bg-muted/30 border-b border-border/50">
                                       {tab.result!.columns.map((column, colIndex) => (
                                         <td key={colIndex} className="px-3 py-2 border-r border-border/30 last:border-r-0">
                                           <div className="max-w-xs truncate" title={String(row[column] || '')}>
                                             {row[column] !== null && row[column] !== undefined 
                                               ? String(row[column]) 
                                               : <span className="text-muted-foreground italic">NULL</span>
                                             }
                                           </div>
                                         </td>
                                       ))}
                                     </tr>
                                   ))}
                                 </tbody>
                               </table>
                             </div>
                           </div>
                                                 ) : (
                           <div className="text-center py-8 text-muted-foreground">
                             Query executed successfully. No data returned.
                           </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

            {/* Query History */}
      {queryHistory.length > 0 && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <History className="w-5 h-5" />
              <span>Query History</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-auto">
              {queryHistory.map((item, index) => (
                <div 
                  key={index}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-muted/30 rounded cursor-pointer hover:bg-muted/50 gap-2"
                  onClick={() => {
                    if (activeTabData) {
                      setTabs(prev => prev.map(tab => 
                        tab.id === activeTab ? { ...tab, query: item.query } : tab
                      ));
                    }
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <code className="text-sm break-all">{item.query}</code>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground flex-shrink-0">
                    <span>{formatExecutionTime(item.executionTime)}</span>
                    <span>{item.timestamp.toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 
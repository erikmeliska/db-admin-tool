'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ConnectionSession, QueryResult } from '@/types/database';
import { queryHistoryManager } from '@/lib/query-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion } from '@codemirror/autocomplete';
import { createSQLCompletion } from '@/lib/sql-completions';
import { useTheme } from '@/components/ThemeProvider';
import { JsonCell } from '@/components/ui/json-cell';
import { Play, Save, History, Clock, Database, HelpCircle, Wrench, Edit3, Sparkles, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
  persistentTabs?: { tabs: QueryTab[], activeTab: string };
  onTabsUpdate?: (tabs: QueryTab[], activeTab: string) => void;
}

export function QueryEditor({ 
  session, 
  onQueryExecute, 
  initialQuery = '', 
  availableTables = [], 
  tableSchemas = {},
  persistentTabs,
  onTabsUpdate
}: QueryEditorProps) {
  const { theme } = useTheme();
  
  // Use persistent tabs if provided, otherwise use default
  const tabs = persistentTabs?.tabs || [{ id: '1', title: 'Query 1', query: initialQuery }];
  const activeTab = persistentTabs?.activeTab || '1';

  // Helper function to update tabs through parent component
  const updateTabs = useCallback((newTabs: QueryTab[], newActiveTab?: string) => {
    if (onTabsUpdate) {
      onTabsUpdate(newTabs, newActiveTab || activeTab);
    }
  }, [onTabsUpdate]);
  const [queryHistory, setQueryHistory] = useState<Array<{ query: string; timestamp: Date; executionTime: number }>>([]);

  // Load persistent history filtered by current connection
  useEffect(() => {
    if (session) {
      const persistentHistory = queryHistoryManager.getHistoryByConnection(session.name);
      const sqlHistory = persistentHistory
        .filter(item => 'query' in item) // Only SQL queries, not AI prompts
        .map(item => ({
          query: (item as any).query,
          timestamp: item.timestamp,
          executionTime: (item as any).executionTime || 0
        }));
      setQueryHistory(sqlHistory);
      
      // Reset processed query ref when session changes
      lastProcessedQueryRef.current = '';
    } else {
      setQueryHistory([]);
    }
  }, [session?.name]);

  // Store current editor content without triggering re-renders
  const editorContentRef = useRef<string>(initialQuery);
  
  // Track the last processed initialQuery to prevent infinite loops
  const lastProcessedQueryRef = useRef<string>('');

  // AI assistance state
  const [aiOperations, setAiOperations] = useState<{
    isExplaining: boolean;
    isFixing: boolean;
    isModifying: boolean;
    isAsking: boolean;
    explanation: string;
    modifyPrompt: string;
    askPrompt: string;
    askResponse: string;
  }>({
    isExplaining: false,
    isFixing: false, 
    isModifying: false,
    isAsking: false,
    explanation: '',
    modifyPrompt: '',
    askPrompt: '',
    askResponse: ''
  });

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  // Determine if we should use dark theme for CodeMirror
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    const updateTheme = () => {
      if (theme === 'dark') {
        setIsDarkTheme(true);
      } else if (theme === 'light') {
        setIsDarkTheme(false);
      } else {
        // For system theme, check the actual applied theme
        setIsDarkTheme(document.documentElement.classList.contains('dark'));
      }
    };

    updateTheme();

    // Listen for system theme changes when using system theme
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Update editor content ref when tab changes
  useEffect(() => {
    if (activeTabData) {
      editorContentRef.current = activeTabData.query;
    }
  }, [activeTab]);



  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      clearTimeout((handleQueryChange as any).timeoutId);
    };
  }, []);

  // Handle initialQuery updates and auto-execute
  useEffect(() => {
    if (initialQuery && 
        initialQuery.trim() && 
        initialQuery !== activeTabData?.query &&
        initialQuery !== lastProcessedQueryRef.current) {
      
      // Mark this query as processed to prevent infinite loops
      lastProcessedQueryRef.current = initialQuery;
      
      // Update the active tab with the new query
      const updatedTabs = tabs.map(tab => 
        tab.id === activeTab ? { ...tab, query: initialQuery } : tab
      );
      updateTabs(updatedTabs);
      
      editorContentRef.current = initialQuery;
      
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
              const updatedTabs = tabs.map(tab => 
                tab.id === activeTab ? { ...tab, result, isExecuting: false } : tab
              );
              updateTabs(updatedTabs);
              
              // History is automatically updated by the persistent storage and the useEffect above

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
  }, [initialQuery, session, onQueryExecute]);

  const updateActiveTab = useCallback((updates: Partial<QueryTab>) => {
    const newTabs = tabs.map(tab => 
      tab.id === activeTab ? { ...tab, ...updates } : tab
    );
    updateTabs(newTabs);
  }, [activeTab, tabs, updateTabs]);

  // Simple handler that just tracks content without re-rendering
  const handleQueryChange = useCallback((value: string) => {
    editorContentRef.current = value;
    
    // Debounce saving to avoid excessive writes
    clearTimeout((handleQueryChange as any).timeoutId);
    (handleQueryChange as any).timeoutId = setTimeout(() => {
      const newTabs = tabs.map(tab => 
        tab.id === activeTab ? { ...tab, query: value } : tab
      );
      updateTabs(newTabs);
    }, 1000); // Save 1 second after user stops typing
  }, [activeTab, tabs, updateTabs]);

  // Sync editor content to state when needed (on execute, save, etc.)
  const syncEditorToState = useCallback(() => {
    const newTabs = tabs.map(tab => 
      tab.id === activeTab ? { ...tab, query: editorContentRef.current } : tab
    );
    updateTabs(newTabs);
  }, [activeTab, tabs, updateTabs]);

  // Get schema information for tables used in the query
  const getUsedTableSchemas = useCallback((query: string) => {
    const usedTables: string[] = [];
    const queryLower = query.toLowerCase();
    
    // Simple regex to find table names after FROM, JOIN, UPDATE, INSERT INTO, DELETE FROM
    const tablePatterns = [
      /from\s+([`"]?)(\w+)\1/gi,
      /join\s+([`"]?)(\w+)\1/gi,
      /update\s+([`"]?)(\w+)\1/gi,
      /insert\s+into\s+([`"]?)(\w+)\1/gi,
      /delete\s+from\s+([`"]?)(\w+)\1/gi
    ];
    
    tablePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(queryLower)) !== null) {
        const tableName = match[2];
        if (availableTables.includes(tableName) && !usedTables.includes(tableName)) {
          usedTables.push(tableName);
        }
      }
    });

    // Build schema context for used tables
    const schemaContext = usedTables.map(table => {
      const schema = tableSchemas[table];
      if (schema) {
        return `Table: ${table}\nColumns: ${schema.map((col: any) => `${col.name} (${col.type})`).join(', ')}\n`;
      }
      return `Table: ${table}\n`;
    }).join('\n');

    return { usedTables, schemaContext };
  }, [availableTables, tableSchemas]);

  // AI assistance functions
  const explainQuery = useCallback(async () => {
    if (!session || !editorContentRef.current.trim()) return;
    
    setAiOperations(prev => ({ ...prev, isExplaining: true, explanation: '' }));
    
    try {
      const { usedTables, schemaContext } = getUsedTableSchemas(editorContentRef.current);
      
      // Build schema array for used tables
      const schema = usedTables.map(tableName => {
        const tableSchema = tableSchemas[tableName];
        return {
          tableName,
          columns: tableSchema || []
        };
      });
      
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionId}`
        },
        body: JSON.stringify({
          action: 'explain',
          description: 'Explain this SQL query in simple terms',
          query: editorContentRef.current,
          schema,
          databaseType: session.type
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setAiOperations(prev => ({ 
          ...prev, 
          explanation: result.explanation || result.query || 'No explanation provided',
          isExplaining: false 
        }));
      } else {
        throw new Error(result.error || 'Failed to explain query');
      }
    } catch (error) {
      console.error('Query explanation failed:', error);
      setAiOperations(prev => ({ 
        ...prev, 
        explanation: `Error: ${error instanceof Error ? error.message : 'Failed to explain query'}`,
        isExplaining: false 
      }));
    }
  }, [session, availableTables, tableSchemas, getUsedTableSchemas]);

  const fixQuery = useCallback(async () => {
    if (!session || !editorContentRef.current.trim()) return;
    
    setAiOperations(prev => ({ ...prev, isFixing: true }));
    
    try {
      const { usedTables, schemaContext } = getUsedTableSchemas(editorContentRef.current);
      
      // Build schema array for used tables
      const schema = usedTables.map(tableName => {
        const tableSchema = tableSchemas[tableName];
        return {
          tableName,
          columns: tableSchema || []
        };
      });
      
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionId}`
        },
        body: JSON.stringify({
          action: 'fix',
          description: 'Fix any issues in this SQL query',
          query: editorContentRef.current,
          schema,
          databaseType: session.type
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        const fixedQuery = result.query || result.explanation || '';
        if (fixedQuery.trim()) {
          // Update both ref and state
          editorContentRef.current = fixedQuery;
          setTabs(prev => prev.map(tab => 
            tab.id === activeTab ? { ...tab, query: fixedQuery } : tab
          ));
        }
        setAiOperations(prev => ({ ...prev, isFixing: false }));
      } else {
        throw new Error(result.error || 'Failed to fix query');
      }
    } catch (error) {
      console.error('Query fix failed:', error);
      setAiOperations(prev => ({ ...prev, isFixing: false }));
    }
  }, [session, availableTables, tableSchemas, getUsedTableSchemas, activeTab]);

  const modifyQuery = useCallback(async () => {
    if (!session || !editorContentRef.current.trim() || !aiOperations.modifyPrompt.trim()) return;
    
    setAiOperations(prev => ({ ...prev, isModifying: true }));
    
    try {
      const { usedTables, schemaContext } = getUsedTableSchemas(editorContentRef.current);
      
      // Build schema array for used tables
      const schema = usedTables.map(tableName => {
        const tableSchema = tableSchemas[tableName];
        return {
          tableName,
          columns: tableSchema || []
        };
      });
      
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionId}`
        },
        body: JSON.stringify({
          action: 'modify',
          description: aiOperations.modifyPrompt,
          query: editorContentRef.current,
          schema,
          databaseType: session.type
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        const modifiedQuery = result.query || result.explanation || '';
        if (modifiedQuery.trim()) {
          // Update both ref and state
          editorContentRef.current = modifiedQuery;
          const updatedTabs = tabs.map(tab => 
            tab.id === activeTab ? { ...tab, query: modifiedQuery } : tab
          );
          updateTabs(updatedTabs);
        }
        setAiOperations(prev => ({ ...prev, isModifying: false, modifyPrompt: '' }));
      } else {
        throw new Error(result.error || 'Failed to modify query');
      }
    } catch (error) {
      console.error('Query modification failed:', error);
      setAiOperations(prev => ({ ...prev, isModifying: false }));
    }
  }, [session, availableTables, tableSchemas, getUsedTableSchemas, activeTab, aiOperations.modifyPrompt]);

  const executeQuery = async () => {
    // Sync editor content to state and get current query
    syncEditorToState();
    const currentQuery = editorContentRef.current;
    if (!session || !currentQuery.trim()) return;

    updateActiveTab({ isExecuting: true, result: undefined });

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionId}`
        },
        body: JSON.stringify({
          query: currentQuery,
        }),
      });

      const result: QueryResult = await response.json();
      
      if (response.ok) {
        updateActiveTab({ result, isExecuting: false });
        
        // Add to persistent history
        if (session) {
          queryHistoryManager.addQueryToHistory({
            type: 'sql',
            query: currentQuery,
            result,
            executionTime: result.executionTime,
            connection: {
              name: session.name,
              type: session.type,
              database: session.database,
            },
          });

          // Refresh local history from persistent storage
          const persistentHistory = queryHistoryManager.getHistoryByConnection(session.name);
          const sqlHistory = persistentHistory
            .filter(item => 'query' in item)
            .map(item => ({
              query: (item as any).query,
              timestamp: item.timestamp,
              executionTime: (item as any).executionTime || 0
            }));
          setQueryHistory(sqlHistory);
        }

        if (onQueryExecute) {
          onQueryExecute(currentQuery, result);
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
    const newTabs = [...tabs, newTab];
    updateTabs(newTabs, newId);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return; // Don't close the last tab
    
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    const newActiveTab = activeTab === tabId ? newTabs[0].id : activeTab;
    
    updateTabs(newTabs, newActiveTab);
  };

  const saveQuery = () => {
    syncEditorToState();
    const currentQuery = editorContentRef.current;
    if (!currentQuery.trim()) return;
    
    const blob = new Blob([currentQuery], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_${activeTab}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const handleAskQuestion = async () => {
    if (!aiOperations.askPrompt.trim()) return;
    
    setAiOperations(prev => ({ ...prev, isAsking: true, askResponse: '' }));
    
    try {
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.sessionId}`
        },
        body: JSON.stringify({
          description: aiOperations.askPrompt,
          schema: getUsedTableSchemas(editorContentRef.current || '') || [],
          databaseType: session?.type,
          action: 'ask',
          query: editorContentRef.current
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to ask question');
      }

      const data = await response.json();
      setAiOperations(prev => ({ 
        ...prev, 
        askResponse: data.explanation || 'No response received'
      }));
    } catch (error) {
      console.error('Ask question error:', error);
      setAiOperations(prev => ({ 
        ...prev, 
        askResponse: 'Error asking question. Please try again.'
      }));
    } finally {
      setAiOperations(prev => ({ ...prev, isAsking: false }));
    }
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
          <Tabs value={activeTab} onValueChange={(newActiveTab) => updateTabs(tabs, newActiveTab)} className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 px-6 sm:px-0">
              <div className="overflow-x-auto">
                <TabsList className="w-max">
                  {tabs.map(tab => (
                    <TabsTrigger key={tab.id} value={tab.id} className="relative whitespace-nowrap">
                      <span className="truncate max-w-[120px]">{tab.title}</span>
                      {tabs.length > 1 && (
                        <span
                          className="ml-2 text-muted-foreground hover:text-foreground flex-shrink-0 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab.id);
                          }}
                        >
                          ×
                        </span>
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
                      key={`${tab.id}-${isDarkTheme}`}
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
                      theme={isDarkTheme ? oneDark : undefined}
                      onChange={handleQueryChange}
                      placeholder="Enter your SQL query here..."
                      style={{ maxWidth: '100%' }}
                    />
                  </div>

                  {/* AI Assistance Panel */}
                  {session && tab.query.trim() && (
                    <Card className="w-full">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Sparkles className="w-5 h-5" />
                          <span>AI Query Assistant</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Universal AI Prompt */}
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Enter your request here:
• EXPLAIN: 'Explain what this query does step by step'
• FIX: 'Fix any syntax errors or performance issues'
• MODIFY: 'Add a WHERE clause to filter by status', 'Convert to use JOINs instead of subqueries'
• ASK: 'Why is this query slow?', 'What indexes would help?', 'Is this query secure?'"
                            value={aiOperations.modifyPrompt}
                            onChange={(e) => setAiOperations(prev => ({ ...prev, modifyPrompt: e.target.value, askPrompt: e.target.value }))}
                            className="min-h-[120px]"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={explainQuery}
                              disabled={aiOperations.isExplaining}
                            >
                              <HelpCircle className="w-4 h-4 mr-2" />
                              {aiOperations.isExplaining ? 'Explaining...' : 'Explain'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={fixQuery}
                              disabled={aiOperations.isFixing}
                            >
                              <Wrench className="w-4 h-4 mr-2" />
                              {aiOperations.isFixing ? 'Fixing...' : 'Fix'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={modifyQuery}
                              disabled={!aiOperations.modifyPrompt.trim() || aiOperations.isModifying}
                            >
                              <Edit3 className="w-4 h-4 mr-2" />
                              {aiOperations.isModifying ? 'Modifying...' : 'Modify'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleAskQuestion}
                              disabled={!aiOperations.askPrompt.trim() || aiOperations.isAsking}
                            >
                              <MessageCircle className="w-4 h-4 mr-2" />
                              {aiOperations.isAsking ? 'Asking...' : 'Ask'}
                            </Button>
                          </div>
                        </div>

                        {/* AI Response */}
                        {(aiOperations.explanation || aiOperations.askResponse) && (
                          <div className="bg-muted/50 p-4 rounded-lg">
                            <h4 className="font-medium mb-2">
                              {aiOperations.explanation ? 'Query Explanation:' : 'Answer:'}
                            </h4>
                            <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown>
                                {aiOperations.explanation || aiOperations.askResponse}
                              </ReactMarkdown>
                            </div>
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

      {/* Query Results - Separate from editor */}
      {activeTabData?.result && (
        <Card className="w-full">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-lg">Query Results</CardTitle>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>{formatExecutionTime(activeTabData.result.executionTime)}</span>
                </div>
                {activeTabData.result.affectedRows !== undefined && (
                  <span>{activeTabData.result.affectedRows} rows affected</span>
                )}
                {activeTabData.result.rows.length > 0 && (
                  <span>{activeTabData.result.rows.length} rows returned</span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {(activeTabData.result as any).error ? (
              <div className="text-destructive bg-destructive/10 p-4 rounded border border-destructive/20">
                <strong>Error:</strong> {(activeTabData.result as any).error}
              </div>
            ) : activeTabData.result.rows.length > 0 ? (
              <div className="w-full overflow-x-auto border rounded-lg">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm table-fixed">
                    <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                      <tr>
                        {activeTabData.result.columns.map((column, index) => (
                          <th key={index} className="px-3 py-2 text-left font-medium border-b border-border whitespace-nowrap w-48 min-w-[120px]">
                            <div className="truncate" title={column}>
                              {column}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeTabData.result.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-muted/30 border-b border-border/50">
                          {activeTabData.result.columns.map((column, colIndex) => (
                            <td key={colIndex} className="px-3 py-2 border-r border-border/30 last:border-r-0 w-48 min-w-[120px]">
                              <div className="w-full h-6 flex items-center overflow-hidden">
                                {row[column] !== null && row[column] !== undefined 
                                  ? <JsonCell value={row[column]} />
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
                    const updatedTabs = tabs.map(tab => 
                      tab.id === activeTab ? { ...tab, query: item.query } : tab
                    );
                    updateTabs(updatedTabs);
                    editorContentRef.current = item.query;
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
'use client';

import { useState, useEffect } from 'react';
import { queryHistoryManager, QueryHistoryItem, AIPromptHistoryItem } from '@/lib/query-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  History, 
  Search, 
  Trash2, 
  Play, 
  Brain, 
  Database, 
  Clock, 
  Filter,
  TrendingUp,
  ExternalLink
} from 'lucide-react';

interface QueryHistoryProps {
  onQuerySelect?: (query: string) => void;
  onQuerySelectNewTab?: (query: string) => void;
  onAIPromptSelect?: (prompt: string, tables: string[]) => void;
  onAIQueryRun?: (query: string) => void;
  onAIQueryRunNewTab?: (query: string) => void;
  currentConnection?: string;
}

export function QueryHistory({ 
  onQuerySelect, 
  onQuerySelectNewTab, 
  onAIPromptSelect, 
  onAIQueryRun, 
  onAIQueryRunNewTab, 
  currentConnection 
}: QueryHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterConnection, setFilterConnection] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');
  const [history, setHistory] = useState<(QueryHistoryItem | AIPromptHistoryItem)[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    let historyData: (QueryHistoryItem | AIPromptHistoryItem)[] = [];
    
    if (activeTab === 'all') {
      historyData = queryHistoryManager.getCombinedHistory();
    } else if (activeTab === 'queries') {
      historyData = queryHistoryManager.getQueryHistory();
    } else if (activeTab === 'ai') {
      historyData = queryHistoryManager.getAIHistory();
    }

    // Apply filters
    if (searchTerm) {
      historyData = queryHistoryManager.searchHistory(searchTerm);
    }
    
    if (filterConnection !== 'all') {
      historyData = queryHistoryManager.getHistoryByConnection(filterConnection);
    }

    setHistory(historyData);
    setStats(queryHistoryManager.getStatistics());
  };

  useEffect(() => {
    loadHistory();
  }, [searchTerm, filterConnection, activeTab]);

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(timestamp);
  };

  const clearHistory = () => {
    if (activeTab === 'queries' || activeTab === 'all') {
      queryHistoryManager.clearQueryHistory();
    }
    if (activeTab === 'ai' || activeTab === 'all') {
      queryHistoryManager.clearAIHistory();
    }
    loadHistory();
  };

  const isQueryItem = (item: QueryHistoryItem | AIPromptHistoryItem): item is QueryHistoryItem => {
    return 'query' in item;
  };

  const isAIItem = (item: QueryHistoryItem | AIPromptHistoryItem): item is AIPromptHistoryItem => {
    return 'prompt' in item;
  };

  const getUniqueConnections = () => {
    const queryHistory = queryHistoryManager.getQueryHistory();
    const aiHistory = queryHistoryManager.getAIHistory();
    
    const connections = new Set<string>();
    queryHistory.forEach(item => connections.add(item.connection.name));
    aiHistory.forEach(item => connections.add(item.connectionName));
    
    return Array.from(connections);
  };

  return (
    <Card className="w-full h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <History className="w-5 h-5" />
            <span>Query History</span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={clearHistory}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.totalQueries}</div>
              <div className="text-xs text-muted-foreground">SQL Queries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">{stats.totalAIPrompts}</div>
              <div className="text-xs text-muted-foreground">AI Prompts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">{formatExecutionTime(stats.avgExecutionTime)}</div>
              <div className="text-xs text-muted-foreground">Avg Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.totalHistoryItems}</div>
              <div className="text-xs text-muted-foreground">Total Items</div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search queries or prompts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={filterConnection}
            onChange={(e) => setFilterConnection(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="all">All Connections</option>
            {getUniqueConnections().map(conn => (
              <option key={conn} value={conn}>{conn}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All History</TabsTrigger>
            <TabsTrigger value="queries">SQL Queries</TabsTrigger>
            <TabsTrigger value="ai">AI Prompts</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No history items found</p>
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isQueryItem(item) ? (
                            <>
                              <Database className="w-4 h-4 text-blue-500" />
                              <Badge variant="outline" className="text-xs">
                                {item.type === 'ai-generated' ? 'AI-Generated SQL' : 'Manual SQL'}
                              </Badge>
                            </>
                          ) : (
                            <>
                              <Brain className="w-4 h-4 text-purple-500" />
                              <Badge variant="secondary" className="text-xs">AI Prompt</Badge>
                            </>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(item.timestamp)}
                          </span>
                        </div>

                        {isQueryItem(item) ? (
                          <>
                            <code className="text-sm bg-muted px-2 py-1 rounded block mb-2 break-all">
                              {item.query}
                            </code>
                            {item.aiPrompt && (
                              <div className="text-xs text-muted-foreground mb-1">
                                <strong>AI Prompt:</strong> {item.aiPrompt}
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatExecutionTime(item.executionTime)}
                              </span>
                              <span>{item.connection.name} ({item.connection.type})</span>
                              {item.resultMetadata && (
                                <span>{item.resultMetadata.rowCount} rows</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm mb-2">
                              <strong>Prompt:</strong> {item.prompt}
                            </div>
                            <code className="text-sm bg-muted px-2 py-1 rounded block mb-2 break-all">
                              {item.generatedQuery}
                            </code>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{item.connectionName} ({item.databaseType})</span>
                              <span>{item.model}</span>
                              {item.selectedTables.length > 0 && (
                                <span>Tables: {item.selectedTables.join(', ')}</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex gap-1">
                        {isQueryItem(item) && (
                          <>
                            {onQuerySelect && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onQuerySelect(item.query)}
                                title="Use this query"
                              >
                                <Play className="w-3 h-3" />
                              </Button>
                            )}
                            {onQuerySelectNewTab && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onQuerySelectNewTab(item.query)}
                                title="Use this query in new tab"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            )}
                          </>
                        )}
                        {isAIItem(item) && (
                          <>
                            {onAIPromptSelect && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onAIPromptSelect(item.prompt, item.selectedTables)}
                                title="Use this prompt"
                              >
                                <Brain className="w-3 h-3" />
                              </Button>
                            )}
                            {onAIQueryRun && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onAIQueryRun(item.generatedQuery)}
                                title="Run query"
                              >
                                <Play className="w-3 h-3" />
                              </Button>
                            )}
                            {onAIQueryRunNewTab && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onAIQueryRunNewTab(item.generatedQuery)}
                                title="Run query in new tab"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 
import { QueryResult } from '@/types/database';

export interface QueryHistoryItem {
  id: string;
  type: 'sql' | 'ai-generated';
  timestamp: Date;
  query: string;
  // Store only result metadata, not the actual data to prevent localStorage bloat
  resultMetadata?: {
    rowCount: number;
    columnCount: number;
    columns: string[];
    executionTime: number;
    affectedRows?: number;
    error?: string;
  };
  executionTime: number;
  connection: {
    name: string;
    type: string;
    database: string;
  };
  // AI-specific fields
  aiPrompt?: string;
  selectedTables?: string[];
  aiModel?: string;
}

export interface AIPromptHistoryItem {
  id: string;
  timestamp: Date;
  prompt: string;
  selectedTables: string[];
  generatedQuery: string;
  databaseType: string;
  connectionName: string;
  model: string;
}

class QueryHistoryManager {
  private readonly QUERY_HISTORY_KEY = 'db-admin-query-history';
  private readonly AI_HISTORY_KEY = 'db-admin-ai-history';
  private readonly MAX_HISTORY_ITEMS = 500;

  // Query History Methods
  addQueryToHistory(item: {
    type: 'sql' | 'ai-generated';
    query: string;
    result?: QueryResult;
    executionTime: number;
    connection: {
      name: string;
      type: string;
      database: string;
    };
    aiPrompt?: string;
    selectedTables?: string[];
    aiModel?: string;
  }): void {
    // Create metadata from result instead of storing full result
    const resultMetadata = item.result ? {
      rowCount: item.result.rows?.length || 0,
      columnCount: item.result.columns?.length || 0,
      columns: item.result.columns || [],
      executionTime: item.result.executionTime || item.executionTime,
      affectedRows: item.result.affectedRows,
      error: (item.result as any).error
    } : undefined;

    const historyItem: QueryHistoryItem = {
      type: item.type,
      query: item.query,
      resultMetadata,
      executionTime: item.executionTime,
      connection: item.connection,
      aiPrompt: item.aiPrompt,
      selectedTables: item.selectedTables,
      aiModel: item.aiModel,
      id: this.generateId(),
      timestamp: new Date(),
    };

    const history = this.getQueryHistory();
    history.unshift(historyItem);
    
    // Keep only the most recent items
    if (history.length > this.MAX_HISTORY_ITEMS) {
      history.splice(this.MAX_HISTORY_ITEMS);
    }

    this.saveQueryHistory(history);
  }

  getQueryHistory(): QueryHistoryItem[] {
    try {
      const stored = localStorage.getItem(this.QUERY_HISTORY_KEY);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      // Convert timestamp strings back to Date objects
      return parsed.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp),
        resultMetadata: item.resultMetadata ? {
          ...item.resultMetadata,
          // Ensure result data is properly typed
        } : undefined,
      }));
    } catch (error) {
      console.error('Failed to load query history:', error);
      return [];
    }
  }

  clearQueryHistory(): void {
    localStorage.removeItem(this.QUERY_HISTORY_KEY);
  }

  // AI History Methods
  addAIPromptToHistory(item: Omit<AIPromptHistoryItem, 'id' | 'timestamp'>): void {
    const historyItem: AIPromptHistoryItem = {
      ...item,
      id: this.generateId(),
      timestamp: new Date(),
    };

    const history = this.getAIHistory();
    history.unshift(historyItem);
    
    // Keep only the most recent items
    if (history.length > this.MAX_HISTORY_ITEMS) {
      history.splice(this.MAX_HISTORY_ITEMS);
    }

    this.saveAIHistory(history);
  }

  getAIHistory(): AIPromptHistoryItem[] {
    try {
      const stored = localStorage.getItem(this.AI_HISTORY_KEY);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      // Convert timestamp strings back to Date objects
      return parsed.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp),
      }));
    } catch (error) {
      console.error('Failed to load AI history:', error);
      return [];
    }
  }

  clearAIHistory(): void {
    localStorage.removeItem(this.AI_HISTORY_KEY);
  }

  // Combined history for display
  getCombinedHistory(): (QueryHistoryItem | AIPromptHistoryItem)[] {
    const queryHistory = this.getQueryHistory();
    const aiHistory = this.getAIHistory();
    
    // Combine and sort by timestamp
    const combined = [
      ...queryHistory.map(item => ({ ...item, historyType: 'query' as const })),
      ...aiHistory.map(item => ({ ...item, historyType: 'ai' as const }))
    ];
    
    return combined.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Search history
  searchHistory(query: string): (QueryHistoryItem | AIPromptHistoryItem)[] {
    const combined = this.getCombinedHistory();
    const searchLower = query.toLowerCase();
    
    return combined.filter(item => {
      if ('query' in item) {
        return item.query.toLowerCase().includes(searchLower) ||
               (item.aiPrompt && item.aiPrompt.toLowerCase().includes(searchLower));
      } else {
        return item.prompt.toLowerCase().includes(searchLower) ||
               item.generatedQuery.toLowerCase().includes(searchLower);
      }
    });
  }

  // Filter by connection
  getHistoryByConnection(connectionName: string): (QueryHistoryItem | AIPromptHistoryItem)[] {
    const combined = this.getCombinedHistory();
    
    return combined.filter(item => {
      if ('connection' in item) {
        return item.connection.name === connectionName;
      } else {
        return item.connectionName === connectionName;
      }
    });
  }

  // Get statistics
  getStatistics() {
    const queryHistory = this.getQueryHistory();
    const aiHistory = this.getAIHistory();
    
    const totalQueries = queryHistory.length;
    const totalAIPrompts = aiHistory.length;
    const avgExecutionTime = queryHistory.length > 0 
      ? queryHistory.reduce((sum, item) => sum + item.executionTime, 0) / queryHistory.length 
      : 0;
    
    const connectionStats = queryHistory.reduce((acc, item) => {
      const connName = item.connection.name;
      acc[connName] = (acc[connName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalQueries,
      totalAIPrompts,
      avgExecutionTime,
      connectionStats,
      totalHistoryItems: totalQueries + totalAIPrompts,
    };
  }

  // Private helpers
  private saveQueryHistory(history: QueryHistoryItem[]): void {
    try {
      localStorage.setItem(this.QUERY_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save query history:', error);
      // If quota exceeded, try to recover by keeping only recent items
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.log('Quota exceeded, reducing history size...');
        const reducedHistory = history.slice(0, 100); // Keep only 100 most recent
        try {
          localStorage.setItem(this.QUERY_HISTORY_KEY, JSON.stringify(reducedHistory));
          console.log('Successfully saved reduced history');
        } catch (secondError) {
          console.error('Still failed after reducing history, clearing all history:', secondError);
          this.clearQueryHistory();
        }
      }
    }
  }

  private saveAIHistory(history: AIPromptHistoryItem[]): void {
    try {
      localStorage.setItem(this.AI_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save AI history:', error);
      // If quota exceeded, try to recover by keeping only recent items
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.log('AI History quota exceeded, reducing history size...');
        const reducedHistory = history.slice(0, 100); // Keep only 100 most recent
        try {
          localStorage.setItem(this.AI_HISTORY_KEY, JSON.stringify(reducedHistory));
          console.log('Successfully saved reduced AI history');
        } catch (secondError) {
          console.error('Still failed after reducing AI history, clearing all AI history:', secondError);
          this.clearAIHistory();
        }
      }
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const queryHistoryManager = new QueryHistoryManager(); 
'use client';

import { useState, useEffect } from 'react';
import { TableSchema } from '@/types/database';
import { queryHistoryManager } from '@/lib/query-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Wand2, Copy, RefreshCw, Brain, Table as TableIcon, RotateCcw, Play, ExternalLink } from 'lucide-react';

interface LLMQueryGeneratorProps {
  availableTables: string[];
  tableSchemas: Record<string, TableSchema>;
  onQueryRun?: (query: string) => void;
  onQueryRunNewTab?: (query: string) => void;
  sessionId?: string;
  databaseType?: string;
  connectionName?: string;
  prefilledPrompt?: string;
  prefilledTables?: string[];
  onLoadTableSchemas?: (tables: string[]) => Promise<void>;
}

export function LLMQueryGenerator({ 
  availableTables, 
  tableSchemas, 
  onQueryRun,
  onQueryRunNewTab,
  sessionId,
  databaseType,
  connectionName,
  prefilledPrompt,
  prefilledTables,
  onLoadTableSchemas
}: LLMQueryGeneratorProps) {
  // Persistent state keys
  const stateKey = sessionId ? `llm-state-${sessionId}` : 'llm-state-default';
  
  // Load persisted state
  const loadPersistedState = () => {
    if (typeof window === 'undefined') return { description: '', selectedTables: [] };
    
    try {
      const saved = localStorage.getItem(stateKey);
      return saved ? JSON.parse(saved) : { description: '', selectedTables: [] };
    } catch {
      return { description: '', selectedTables: [] };
    }
  };

  const [description, setDescription] = useState(() => {
    // Use prefilled prompt if provided, otherwise load from storage
    if (prefilledPrompt) return prefilledPrompt;
    return loadPersistedState().description;
  });
  
  const [selectedTables, setSelectedTables] = useState<string[]>(() => {
    // Use prefilled tables if provided (including empty array), otherwise load from storage
    if (prefilledTables !== undefined) return prefilledTables;
    return loadPersistedState().selectedTables;
  });

  // Handle prefilled data updates
  useEffect(() => {
    if (prefilledPrompt !== undefined) {
      setDescription(prefilledPrompt);
    }
    if (prefilledTables !== undefined) {
      setSelectedTables(prefilledTables); // This will be [] when "use all" was originally selected
    }
  }, [prefilledPrompt, prefilledTables]);
  const [generatedQuery, setGeneratedQuery] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  // Persist state when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const state = { description, selectedTables };
      localStorage.setItem(stateKey, JSON.stringify(state));
    }
  }, [description, selectedTables, stateKey]);

  const generateQuery = async () => {
    if (!description.trim() || !sessionId) return;

    setIsGenerating(true);
    setError('');
    
    try {
      // Get schema for selected tables (or all if none selected)
      const tablesToInclude = selectedTables.length > 0 ? selectedTables : availableTables;
      
      // Load schemas for tables that don't have them yet
      const missingSchemas = tablesToInclude.filter(tableName => !tableSchemas[tableName]);
      if (missingSchemas.length > 0 && onLoadTableSchemas) {
        await onLoadTableSchemas(missingSchemas);
      }
      
      const relevantSchemas = tablesToInclude
        .map(tableName => tableSchemas[tableName])
        .filter(Boolean);

      // console.log('Tables to include:', tablesToInclude);
      // console.log('Available table schemas:', Object.keys(tableSchemas));
      // console.log('Relevant schemas:', relevantSchemas);

      // Get API key from localStorage
      const apiKey = localStorage.getItem('google-api-key');
      if (!apiKey) {
        setError('Google API key not configured. Please set it in Settings.');
        return;
      }

      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          schema: relevantSchemas,
          databaseType: databaseType || 'mysql',
          apiKey,
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setGeneratedQuery(result.query);
        setExplanation(result.explanation);

        // Add to AI history
        if (sessionId && databaseType && connectionName) {
          queryHistoryManager.addAIPromptToHistory({
            prompt: description,
            selectedTables: selectedTables, // Save actual selection - empty array means "use all"
            generatedQuery: result.query,
            databaseType: databaseType,
            connectionName: connectionName,
            model: 'gemini-2.0-flash-lite',
          });
        }
      } else {
        setError(result.error || 'Failed to generate query');
      }
    } catch (err) {
      setError(`Network error: ${err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };



  const toggleTableSelection = (tableName: string) => {
    setSelectedTables(prev => 
      prev.includes(tableName) 
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    );
  };

  const toggleAllTables = () => {
    if (selectedTables.length === availableTables.length) {
      // If all are selected, unselect all
      setSelectedTables([]);
    } else {
      // If not all are selected, select all
      setSelectedTables(availableTables);
    }
  };

  const resetForm = () => {
    setDescription('');
    setSelectedTables([]);
    setGeneratedQuery('');
    setExplanation('');
    setError('');
  };

  const sampleQueries = [
    "Show me all users who registered in the last 30 days",
    "Find the top 10 best-selling products by revenue",
    "List customers who haven't placed any orders",
    "Calculate the total sales for each month this year",
    "Show products that are out of stock",
    "Find the average order value by customer segment",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Brain className="w-5 h-5" />
          <span>AI Query Generator</span>
          {databaseType && (
            <Badge variant="outline">{databaseType}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Description Input */}
        <div className="space-y-2">
          <Label htmlFor="description">Describe what you want to query:</Label>
          <Textarea
            id="description"
            placeholder="e.g., Show me all customers who made purchases in the last month"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Sample Queries */}
        <div className="space-y-2">
          <Label>Quick Examples:</Label>
          <div className="flex flex-wrap gap-2">
            {sampleQueries.map((sample, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => setDescription(sample)}
                className="text-xs"
              >
                {sample}
              </Button>
            ))}
          </div>
        </div>

        {/* Table Selection */}
        {availableTables.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Include Tables (optional - leave empty to include all):</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAllTables}
                className="text-xs"
              >
                {selectedTables.length === availableTables.length ? 'Unselect All' : 'Select All'}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableTables.map(tableName => (
                <Button
                  key={tableName}
                  variant={selectedTables.includes(tableName) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleTableSelection(tableName)}
                  className="text-xs"
                >
                  <TableIcon className="w-3 h-3 mr-1" />
                  {tableName}
                </Button>
              ))}
            </div>
            {selectedTables.length > 0 && (
              <div className="text-sm text-gray-500">
                Selected {selectedTables.length} of {availableTables.length} tables
              </div>
            )}
          </div>
        )}

        {/* Selected Tables Schema Preview */}
        {selectedTables.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="schema-preview">
              <AccordionTrigger 
                className="text-sm"
                onClick={async () => {
                  // Load schemas for selected tables that don't have them yet
                  const missingSchemas = selectedTables.filter(tableName => !tableSchemas[tableName]);
                  if (missingSchemas.length > 0 && onLoadTableSchemas) {
                    await onLoadTableSchemas(missingSchemas);
                  }
                }}
              >
                Preview Selected Tables Schema
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {selectedTables.map(tableName => {
                    const schema = tableSchemas[tableName];
                    if (!schema) {
                      return (
                        <div key={tableName} className="bg-gray-50 p-3 rounded">
                          <div className="font-medium text-sm mb-2">{tableName}</div>
                          <div className="text-xs text-gray-500 italic">Loading schema...</div>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={tableName} className="bg-gray-50 p-3 rounded">
                        <div className="font-medium text-sm mb-2">{tableName}</div>
                        <div className="text-xs text-gray-600 space-y-1">
                          {schema.columns.map(col => (
                            <div key={col.name} className="flex items-center space-x-2">
                              <span className="font-mono">{col.name}</span>
                              <Badge variant="outline" className="text-xs">{col.type}</Badge>
                              {col.key === 'PRI' && <Badge variant="secondary" className="text-xs">PK</Badge>}
                              {!col.nullable && <Badge variant="destructive" className="text-xs">NN</Badge>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Generate and Reset Buttons */}
        <div className="flex space-x-2">
          <Button 
            onClick={generateQuery}
            disabled={!description.trim() || !sessionId || isGenerating}
            className="flex-1"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Generate SQL Query'}
          </Button>
          <Button 
            variant="outline"
            onClick={resetForm}
            disabled={isGenerating}
            className="flex-shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Generated Query */}
        {generatedQuery && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Generated SQL Query:</Label>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(generatedQuery)}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateQuery}
                  disabled={isGenerating}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Regenerate
                </Button>
                {onQueryRun && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onQueryRun(generatedQuery)}
                    title="Run query"
                  >
                    <Play className="w-3 h-3" />
                  </Button>
                )}
                {onQueryRunNewTab && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onQueryRunNewTab(generatedQuery)}
                    title="Run query in new tab"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            
            <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm overflow-x-auto">
              {generatedQuery}
            </div>

            {explanation && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
                <strong>Explanation:</strong> {explanation}
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="text-xs text-gray-500 space-y-1">
          <div><strong>Tips:</strong></div>
          <div>• Be specific about what data you want to retrieve</div>
          <div>• Mention table relationships if you need data from multiple tables</div>
          <div>• Include any filtering conditions or sorting requirements</div>
          <div>• Specify if you need aggregations (count, sum, average, etc.)</div>
        </div>
      </CardContent>
    </Card>
  );
} 
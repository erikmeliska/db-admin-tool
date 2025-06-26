'use client';

import { useState } from 'react';
import { ConnectionConfig, TableSchema, DatabaseType } from '@/types/database';
import { queryHistoryManager } from '@/lib/query-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Wand2, Copy, RefreshCw, Brain, Table as TableIcon } from 'lucide-react';

interface LLMQueryGeneratorProps {
  connection?: ConnectionConfig;
  availableTables: string[];
  tableSchemas: Record<string, TableSchema>;
  onQueryGenerated: (query: string) => void;
  onUseQuery?: (query: string) => void;
}

export function LLMQueryGenerator({ 
  connection, 
  availableTables, 
  tableSchemas, 
  onQueryGenerated,
  onUseQuery
}: LLMQueryGeneratorProps) {
  const [description, setDescription] = useState('');
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [generatedQuery, setGeneratedQuery] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const generateQuery = async () => {
    if (!description.trim() || !connection) return;

    setIsGenerating(true);
    setError('');
    
    try {
      // Get schema for selected tables (or all if none selected)
      const tablesToInclude = selectedTables.length > 0 ? selectedTables : availableTables;
      const relevantSchemas = tablesToInclude
        .map(tableName => tableSchemas[tableName])
        .filter(Boolean);

      console.log('Tables to include:', tablesToInclude);
      console.log('Available table schemas:', Object.keys(tableSchemas));
      console.log('Relevant schemas:', relevantSchemas);

      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          schema: relevantSchemas,
          databaseType: connection.type,
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setGeneratedQuery(result.query);
        setExplanation(result.explanation);

        // Add to AI history
        if (connection) {
          queryHistoryManager.addAIPromptToHistory({
            prompt: description,
            selectedTables: selectedTables.length > 0 ? selectedTables : availableTables,
            generatedQuery: result.query,
            databaseType: connection.type,
            connectionName: connection.name,
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

  const insertQuery = () => {
    if (generatedQuery) {
      if (onUseQuery) {
        onUseQuery(generatedQuery);
      } else {
        onQueryGenerated(generatedQuery);
      }
    }
  };

  const toggleTableSelection = (tableName: string) => {
    setSelectedTables(prev => 
      prev.includes(tableName) 
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    );
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
          {connection && (
            <Badge variant="outline">{connection.type}</Badge>
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
            <Label>Include Tables (optional - leave empty to include all):</Label>
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
              <AccordionTrigger className="text-sm">
                Preview Selected Tables Schema
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {selectedTables.map(tableName => {
                    const schema = tableSchemas[tableName];
                    if (!schema) return null;
                    
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

        {/* Generate Button */}
        <Button 
          onClick={generateQuery}
          disabled={!description.trim() || !connection || isGenerating}
          className="w-full"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          {isGenerating ? 'Generating...' : 'Generate SQL Query'}
        </Button>

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
                <Button size="sm" onClick={insertQuery}>
                  Use Query
                </Button>
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
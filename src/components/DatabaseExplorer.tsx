'use client';

import { useState, useEffect } from 'react';
import { ConnectionConfig, TableSchema } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Database, Search, Table as TableIcon, Key, Hash } from 'lucide-react';

interface DatabaseExplorerProps {
  connection: ConnectionConfig;
  onTableSelect?: (tableName: string, schema: TableSchema) => void;
}

export function DatabaseExplorer({ connection, onTableSelect }: DatabaseExplorerProps) {
  const [tables, setTables] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<Record<string, TableSchema>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingSchema, setLoadingSchema] = useState<string | null>(null);

  useEffect(() => {
    loadTables();
  }, [connection]);

  const loadTables = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'tables',
        config: JSON.stringify(connection),
      });
      
      const response = await fetch(`/api/query?${params}`);
      const result = await response.json();
      
      if (result.tables) {
        setTables(result.tables);
      }
    } catch (error) {
      console.error('Failed to load tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTableSchema = async (tableName: string) => {
    if (schemas[tableName]) {
      return schemas[tableName];
    }

    setLoadingSchema(tableName);
    try {
      const params = new URLSearchParams({
        action: 'schema',
        table: tableName,
        config: JSON.stringify(connection),
      });
      
      const response = await fetch(`/api/query?${params}`);
      const result = await response.json();
      
      if (result.schema) {
        setSchemas(prev => ({ ...prev, [tableName]: result.schema }));
        return result.schema;
      }
    } catch (error) {
      console.error('Failed to load schema:', error);
    } finally {
      setLoadingSchema(null);
    }
    return null;
  };

  const handleTableClick = async (tableName: string) => {
    const schema = await loadTableSchema(tableName);
    if (schema && onTableSelect) {
      onTableSelect(tableName, schema);
    }
  };

  const filteredTables = tables.filter(table =>
    table.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getColumnIcon = (column: any) => {
    if (column.key === 'PRI') return <Key className="w-4 h-4 text-yellow-500" />;
    if (column.autoIncrement) return <Hash className="w-4 h-4 text-blue-500" />;
    return null;
  };

  const getColumnBadge = (column: any) => {
    if (column.key === 'PRI') return <Badge variant="secondary" className="text-xs">PK</Badge>;
    if (column.autoIncrement) return <Badge variant="outline" className="text-xs">AI</Badge>;
    if (!column.nullable) return <Badge variant="destructive" className="text-xs">NN</Badge>;
    return null;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Database className="w-6 h-6 animate-spin mr-2" />
            Loading database schema...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Database className="w-5 h-5" />
          <span>Database Explorer</span>
          <Badge variant="outline">{connection.name}</Badge>
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search tables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filteredTables.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? 'No tables found matching your search.' : 'No tables found in this database.'}
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-2">
            {filteredTables.map((tableName) => (
              <AccordionItem key={tableName} value={tableName} className="border rounded-lg">
                <AccordionTrigger 
                  className="px-4 hover:no-underline"
                  onClick={() => loadTableSchema(tableName)}
                >
                  <div className="flex items-center space-x-2">
                    <TableIcon className="w-4 h-4" />
                    <span>{tableName}</span>
                    {loadingSchema === tableName && (
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {schemas[tableName] ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          {schemas[tableName].columns.length} columns
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleTableClick(tableName)}
                        >
                          Select Table
                        </Button>
                      </div>
                      
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Column</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Attributes</TableHead>
                            <TableHead>Default</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {schemas[tableName].columns.map((column) => (
                            <TableRow key={column.name}>
                              <TableCell className="font-medium">
                                <div className="flex items-center space-x-2">
                                  {getColumnIcon(column)}
                                  <span>{column.name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                                  {column.type}
                                </code>
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-1">
                                  {getColumnBadge(column)}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-gray-500">
                                {column.default !== null && column.default !== undefined 
                                  ? String(column.default) 
                                  : '-'
                                }
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      Click to load table schema
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
} 
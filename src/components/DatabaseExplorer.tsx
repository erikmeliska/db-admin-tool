'use client';

import React, { useState } from 'react';
import { TableSchema } from '@/types/database';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Database, 
  Table, 
  Key, 
  Hash, 
  Calendar, 
  Type, 
  Search,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface DatabaseExplorerProps {
  onTableSelect: (tableName: string, schema: TableSchema) => void;
  availableTables: string[];
  tableSchemas: Record<string, TableSchema>;
  loadingSchemas: boolean;
}

export function DatabaseExplorer({ 
  onTableSelect, 
  availableTables, 
  tableSchemas, 
  loadingSchemas 
}: DatabaseExplorerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const handleTableClick = (tableName: string) => {
    const schema = tableSchemas[tableName];
    if (schema) {
      onTableSelect(tableName, schema);
    }
  };

  const toggleTableExpansion = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const filteredTables = availableTables.filter(table => 
    table.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getColumnIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('int') || lowerType.includes('number') || lowerType.includes('decimal')) {
      return <Hash className="w-3 h-3" />;
    }
    if (lowerType.includes('date') || lowerType.includes('time')) {
      return <Calendar className="w-3 h-3" />;
    }
    return <Type className="w-3 h-3" />;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Database Explorer</h3>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search tables..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {loadingSchemas ? (
          <div className="text-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading tables...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-8">
            <Table className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              {searchTerm ? 'No tables match your search' : 'No tables found'}
            </p>
          </div>
        ) : (
          filteredTables.map((tableName) => {
            const schema = tableSchemas[tableName];
            const isExpanded = expandedTables.has(tableName);
            
            return (
              <Card key={tableName} className="border-border/50 p-0">
                <CardHeader className="p-1 gap-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleTableExpansion(tableName)}
                        className="h-6 w-6 p-0 flex-shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                      <Table className="w-4 h-4 text-primary flex-shrink-0" />
                      <span 
                        className="font-medium text-sm cursor-pointer hover:text-primary transition-colors truncate"
                        onClick={() => handleTableClick(tableName)}
                        title={tableName}
                      >
                        {tableName}
                      </span>
                    </div>
                    {schema && (
                      <Badge variant="secondary" className="text-xs">
                        {schema.columns.length} cols
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                
                {isExpanded && schema && (
                  <CardContent className="p-2 pt-0">
                    <div className="space-y-2">
                      <Separator />
                      <div className="space-y-1">
                        {schema.columns.map((column, index) => (
                          <div key={index} className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              {getColumnIcon(column.type)}
                              <span className="font-medium truncate" title={column.name}>
                                {column.name}
                              </span>
                              {column.key === 'PRI' && (
                                <Key className="w-3 h-3 text-yellow-500" />
                              )}
                            </div>
                            <div className="flex items-center space-x-1 flex-shrink-0">
                            {!column.nullable && (
                                <Badge variant="outline" className="text-xs text-destructive border-destructive px-1 py-0">
                                  NOT NULL
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                {column.type}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
} 
import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { TableSchema } from '@/types/database';

export interface SQLCompletionConfig {
  tables: string[];
  schemas: Record<string, TableSchema>;
}

// SQL keywords for basic completion
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
  'TABLE', 'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'DATABASE', 'SCHEMA',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'ON', 'USING',
  'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
  'UNION', 'ALL', 'DISTINCT', 'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'LIKE', 'BETWEEN', 'IS', 'NULL',
  'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'COALESCE', 'CONCAT', 'SUBSTRING',
  'CAST', 'CONVERT', 'DATE', 'TIME', 'TIMESTAMP', 'INTERVAL',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT',
  'AUTO_INCREMENT', 'NOT', 'NULL', 'CONSTRAINT'
];

// SQL data types
const SQL_TYPES = [
  'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'MEDIUMTEXT', 'TINYTEXT',
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
  'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL',
  'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'YEAR',
  'BOOL', 'BOOLEAN', 'BIT',
  'BLOB', 'LONGBLOB', 'MEDIUMBLOB', 'TINYBLOB',
  'BINARY', 'VARBINARY',
  'JSON', 'GEOMETRY', 'POINT', 'POLYGON'
];

export function createSQLCompletion(config: SQLCompletionConfig) {
  return function sqlCompletion(context: CompletionContext): CompletionResult | null {
    const word = context.matchBefore(/\w*/);
    if (!word) return null;

    const { from, to, text } = word;
    const beforeCursor = context.state.doc.sliceString(0, from);
    
    const completions: Array<{
      label: string;
      type: string;
      info?: string;
      apply?: string;
      boost?: number;
    }> = [];

    // Determine completion context
    const isAfterSelect = /\bselect\s+[\w\s,]*$/i.test(beforeCursor);
    const isAfterFrom = /\bfrom\s+[\w\s]*$/i.test(beforeCursor);
    const isAfterWhere = /\bwhere\s+[\w\s]*$/i.test(beforeCursor);
    const isAfterJoin = /\b(?:join|inner\s+join|left\s+join|right\s+join)\s+[\w\s]*$/i.test(beforeCursor);
    const isAfterOn = /\bon\s+[\w\s]*$/i.test(beforeCursor);
    const hasTableContext = /\b(\w+)\.\w*$/i.exec(beforeCursor);
    const isAfterOrderBy = /\border\s+by\s+[\w\s,]*$/i.test(beforeCursor);
    const isAfterGroupBy = /\bgroup\s+by\s+[\w\s,]*$/i.test(beforeCursor);

    // Table.column completion
    if (hasTableContext) {
      const tableName = hasTableContext[1];
      const schema = config.schemas[tableName];
      
      if (schema) {
        schema.columns.forEach(column => {
          completions.push({
            label: column.name,
            type: 'property',
            info: `${column.type}${!column.nullable ? ' NOT NULL' : ''}${column.key === 'PRI' ? ' PRIMARY KEY' : ''}`,
            boost: 10
          });
        });
      }
      
      return {
        from,
        to,
        options: completions,
        validFor: /^\w*$/
      };
    }

    // Table name completions
    if (isAfterFrom || isAfterJoin) {
      config.tables.forEach(table => {
        const schema = config.schemas[table];
        const columnCount = schema ? schema.columns.length : 0;
        
        completions.push({
          label: table,
          type: 'class',
          info: `Table with ${columnCount} columns`,
          boost: 15
        });
      });
    }

    // Column name completions (when no table prefix)
    if (isAfterSelect || isAfterWhere || isAfterOn || isAfterOrderBy || isAfterGroupBy) {
      // Get all unique column names from all tables
      const allColumns = new Set<string>();
      const columnInfo: Record<string, Array<{table: string; type: string; key?: string}>> = {};
      
      Object.entries(config.schemas).forEach(([tableName, schema]) => {
        schema.columns.forEach(column => {
          allColumns.add(column.name);
          if (!columnInfo[column.name]) {
            columnInfo[column.name] = [];
          }
          columnInfo[column.name].push({
            table: tableName,
            type: column.type,
            key: column.key
          });
        });
      });

      allColumns.forEach(columnName => {
        const info = columnInfo[columnName];
        const tables = info.map(i => i.table).join(', ');
        const types = [...new Set(info.map(i => i.type))].join(' | ');
        
        completions.push({
          label: columnName,
          type: 'property',
          info: `${types} (in: ${tables})`,
          boost: 8
        });
      });
    }

    // SQL Keywords
    SQL_KEYWORDS.forEach(keyword => {
      if (keyword.toLowerCase().startsWith(text.toLowerCase())) {
        completions.push({
          label: keyword,
          type: 'keyword',
          boost: 5
        });
      }
    });

    // SQL Types (useful after CREATE TABLE, ALTER TABLE, etc.)
    if (/\b(?:create\s+table|alter\s+table|add\s+column)\b.*$/i.test(beforeCursor)) {
      SQL_TYPES.forEach(type => {
        if (type.toLowerCase().startsWith(text.toLowerCase())) {
          completions.push({
            label: type,
            type: 'type',
            boost: 7
          });
        }
      });
    }

    // Function completions
    const functions = ['COUNT(*)', 'SUM()', 'AVG()', 'MAX()', 'MIN()', 'CONCAT()', 'SUBSTRING()', 'UPPER()', 'LOWER()', 'LENGTH()', 'NOW()', 'CURDATE()', 'CURTIME()'];
    functions.forEach(func => {
      if (func.toLowerCase().startsWith(text.toLowerCase())) {
        completions.push({
          label: func,
          type: 'function',
          boost: 6
        });
      }
    });

    if (completions.length === 0) return null;

    return {
      from,
      to,
      options: completions.sort((a, b) => (b.boost || 0) - (a.boost || 0)),
      validFor: /^\w*$/
    };
  };
} 
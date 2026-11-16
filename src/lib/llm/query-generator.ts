import { DatabaseType, TableSchema, ColumnInfo } from '@/types/database';
import { complete, stripCodeFence, LLMSelection } from './bridge';

// Clients send schemas in two shapes: TableSchema ({ name, columns: [] }) from the
// generator, and { tableName, columns: TableSchema } from the editor. Accept both.
type LooseSchema = {
  name?: string;
  tableName?: string;
  columns?: ColumnInfo[] | { columns?: ColumnInfo[] };
  foreignKeys?: TableSchema['foreignKeys'];
};

function normalize(schema: LooseSchema[] | undefined): TableSchema[] {
  if (!Array.isArray(schema)) return [];
  return schema
    .map((s) => {
      const columns = Array.isArray(s.columns) ? s.columns : s.columns?.columns ?? [];
      const foreignKeys = s.foreignKeys ?? (s.columns && !Array.isArray(s.columns) ? (s.columns as TableSchema).foreignKeys : undefined);
      return { name: s.name ?? s.tableName ?? '', columns, foreignKeys };
    })
    .filter((s) => s.name);
}

export function schemaAsDDL(schema: TableSchema[]): string {
  return schema
    .map((table) => {
      const columns = table.columns
        .map((col) => {
          let colDef = `  ${col.name} ${col.type}`;
          if (col.key === 'PRI') colDef += ' PRIMARY KEY';
          if (col.autoIncrement) colDef += ' AUTO_INCREMENT';
          if (!col.nullable) colDef += ' NOT NULL';
          if (col.default !== null && col.default !== undefined) colDef += ` DEFAULT ${col.default}`;
          return colDef;
        })
        .join(',\n');
      const foreignKeys =
        table.foreignKeys
          ?.map((fk) => `  FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencedTable}(${fk.referencedColumn})`)
          .join(',\n') || '';
      return `CREATE TABLE ${table.name} (\n${columns}${foreignKeys ? ',\n' + foreignKeys : ''}\n);`;
    })
    .join('\n\n');
}

const SQL_ONLY = 'Return ONLY the SQL query as plain text: no markdown fences, no comments, no explanations.';

export function generateQueryPrompt(description: string, schema: TableSchema[], databaseType: DatabaseType) {
  return `You are an expert SQL developer. Generate a ${databaseType} query based on the user's request.

IMPORTANT: Use ONLY the tables and columns in the schema below. Never invent table or column names.

USER REQUEST: ${description}

DATABASE SCHEMA (${databaseType}):
${schemaAsDDL(schema)}

AVAILABLE TABLES: ${schema.map((t) => t.name).join(', ')}

RULES:
1. Use proper ${databaseType} SQL syntax
2. Include appropriate JOINs when working with multiple tables, using foreign key relationships
3. Add LIMIT 100 to SELECT queries
4. If the request cannot be fulfilled with the available schema, return: -- ERROR: Cannot generate query with available tables
5. ${SQL_ONLY}`;
}

export type LLMAction = 'generate' | 'explain' | 'fix' | 'modify' | 'ask';

export interface LLMRequest {
  action: LLMAction;
  description: string;
  databaseType: DatabaseType;
  schema?: LooseSchema[];
  query?: string;
}

export function buildPrompt({ action, description, databaseType, schema, query }: LLMRequest): string {
  const tables = normalize(schema);
  const schemaBlock = tables.length ? `Database schema:\n${schemaAsDDL(tables)}\n\n` : '';

  switch (action) {
    case 'generate':
      return generateQueryPrompt(description, tables, databaseType);
    case 'explain':
      return `You are an expert SQL analyst. Explain this ${databaseType} query in simple, clear terms.

${schemaBlock}SQL query:
${query}

Cover: what data it retrieves or modifies, which tables and columns are involved, how the JOINs work, filtering and grouping, and the business purpose. Write for a non-technical reader, use markdown.`;
    case 'fix':
      return `You are an expert SQL developer. Analyze and fix any issues in this ${databaseType} query (syntax, wrong table or column names, JOIN issues, logic errors, performance).

${schemaBlock}Current query:
${query}

Instructions:
${description}

${SQL_ONLY}`;
    case 'modify':
      return `You are an expert SQL developer. Modify this ${databaseType} query according to the request.

${schemaBlock}Current query:
${query}

Modification request:
${description}

${SQL_ONLY}`;
    case 'ask':
      return `You are an expert SQL analyst. Answer the user's question about this ${databaseType} query.

${schemaBlock}SQL query:
${query}

Question:
${description}

Give a detailed, helpful answer formatted in markdown.`;
  }
}

export async function runLLMAction(request: LLMRequest, selection?: LLMSelection) {
  const text = await complete(buildPrompt(request), selection);
  switch (request.action) {
    case 'generate':
      return { query: stripCodeFence(text), explanation: `Generated ${request.databaseType} query based on: "${request.description}"` };
    case 'fix':
    case 'modify':
      return { query: stripCodeFence(text) };
    case 'explain':
    case 'ask':
      return { explanation: text };
  }
}

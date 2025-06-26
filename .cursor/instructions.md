# Database Admin Tool - Cursor Instructions

## Project Setup

### 1. Initialize Project
```bash
npx create-next-app@latest db-admin-tool --typescript --tailwind --eslint --app
cd db-admin-tool
```

### 2. Install Dependencies
```bash
# UI Components
npm install @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-button @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-input @radix-ui/react-label @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-table @radix-ui/react-tabs @radix-ui/react-textarea @radix-ui/react-toast

# Utility libraries
npm install class-variance-authority clsx tailwind-merge lucide-react

# Database drivers
npm install mysql2 pg sqlite3 mongodb tedious better-sqlite3

# Code editor for SQL
npm install @codemirror/view @codemirror/state @codemirror/lang-sql @codemirror/theme-one-dark @uiw/react-codemirror

# Types
npm install @types/mysql2 @types/pg @types/better-sqlite3

# LLM integration
npm install openai
```

### 3. Setup shadcn/ui
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input label select textarea table tabs accordion alert-dialog dropdown-menu separator toast card badge
```

## Project Structure

Create this folder structure:
```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── api/
│       ├── connections/
│       │   └── route.ts
│       ├── query/
│       │   └── route.ts
│       └── llm/
│           └── route.ts
├── components/
│   ├── ui/ (shadcn components)
│   ├── ConnectionManager.tsx
│   ├── DatabaseExplorer.tsx
│   ├── QueryEditor.tsx
│   ├── ResultsTable.tsx
│   └── LLMQueryGenerator.tsx
├── lib/
│   ├── database/
│   │   ├── connections.ts
│   │   ├── mysql.ts
│   │   ├── postgresql.ts
│   │   ├── sqlite.ts
│   │   └── types.ts
│   ├── llm/
│   │   └── query-generator.ts
│   └── utils.ts
└── types/
    └── database.ts
```

## Key Components to Build

### 1. Database Connection Types (`types/database.ts`)
```typescript
export type DatabaseType = 'mysql' | 'postgresql' | 'sqlite' | 'mongodb';

export interface ConnectionConfig {
  id: string;
  name: string;
  type: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  filename?: string; // for SQLite
}

export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  indexes?: IndexInfo[];
  foreignKeys?: ForeignKeyInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  key?: string;
  default?: any;
  autoIncrement?: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: any[];
  affectedRows?: number;
  executionTime: number;
}
```

### 2. Database Connection Manager (`lib/database/connections.ts`)
Create a unified interface for different database types:
- MySQL connection handling
- PostgreSQL connection handling  
- SQLite connection handling
- Connection pooling
- Error handling
- Schema introspection methods

### 3. Main Layout (`app/layout.tsx`)
- Dark/light theme toggle
- Sidebar for connections
- Main content area
- Toast notifications

### 4. Connection Manager Component (`components/ConnectionManager.tsx`)
- Form to add new database connections
- Test connection functionality
- Save/load connection configs (use localStorage)
- Connection status indicators
- Delete/edit existing connections

### 5. Database Explorer Component (`components/DatabaseExplorer.tsx`)
- Tree view of databases → tables → columns
- Show table row counts
- Table metadata (indexes, foreign keys)
- Right-click context menu for tables
- Search/filter tables

### 6. Query Editor Component (`components/QueryEditor.tsx`)
- CodeMirror integration with SQL syntax highlighting
- Multiple query tabs
- Query history
- Save/load queries
- Execute query button
- Query execution time display

### 7. LLM Query Generator Component (`components/LLMQueryGenerator.tsx`)
- Text input for natural language query description
- Schema context dropdown (select tables to include)
- Generate query button
- Insert generated query into editor
- Query explanation/comments
- Regenerate options

### 8. Results Table Component (`components/ResultsTable.tsx`)
- Paginated table display
- Export to CSV/JSON
- Column sorting
- Row selection
- Inline editing for simple updates
- Error display for failed queries

## Server Actions & API Routes

### 1. Connection API (`app/api/connections/route.ts`)
- GET: Test database connection
- POST: Save connection config
- PUT: Update connection
- DELETE: Remove connection

### 2. Query API (`app/api/query/route.ts`)
- POST: Execute SQL query
- GET: Retrieve query history
- Handle different database types
- Query timeout handling
- Result pagination

### 3. LLM API (`app/api/llm/route.ts`)
- POST: Generate SQL query from natural language
- Include schema context in prompt
- Handle OpenAI API integration
- Error handling for API failures

## LLM Integration Strategy

### Query Generation Prompt Template:
```typescript
const generateQueryPrompt = (
  description: string,
  schema: TableSchema[],
  databaseType: DatabaseType
) => `
You are a SQL expert. Generate a ${databaseType} query based on this request:

USER REQUEST: ${description}

AVAILABLE TABLES AND SCHEMA:
${schema.map(table => `
Table: ${table.name}
Columns: ${table.columns.map(col => `${col.name} (${col.type}${col.nullable ? ', nullable' : ''})`).join(', ')}
`).join('\n')}

Requirements:
- Return only the SQL query, no explanation
- Use proper ${databaseType} syntax
- Include appropriate JOINs if multiple tables are needed
- Add LIMIT clause for SELECT queries to prevent large results
- Use proper quoting for identifiers if needed

SQL Query:
`;
```

## Environment Variables
Create `.env.local`:
```
GOOGLE_API_KEY=your_google_gemini_api_key
```

## Key Features to Implement

### Phase 1 (MVP):
1. Connection management (MySQL, PostgreSQL, SQLite)
2. Database/table explorer
3. Basic SQL query editor
4. Results display
5. LLM query generation

### Phase 2 (Enhanced):
1. Query history and favorites
2. Export functionality
3. Advanced schema information
4. Query performance metrics
5. Multiple database connections simultaneously

### Phase 3 (Advanced):
1. Visual query builder
2. Database migration tools  
3. User management and permissions
4. Query scheduling
5. Data visualization charts

## Development Tips for Cursor

1. **Use Cursor's AI features:**
   - Use Ctrl+K to generate boilerplate code for components
   - Use Cursor's chat to debug database connection issues
   - Let AI help with TypeScript type definitions

2. **Server Actions pattern:**
   - Use server actions for database operations
   - Handle errors properly with try-catch
   - Use revalidatePath for data updates

3. **State Management:**
   - Use React's useState for component state
   - Consider zustand for global state (connections, query history)
   - Use localStorage for persisting connection configs

4. **Security Considerations:**
   - Never store passwords in localStorage in production
   - Validate all SQL queries on server side
   - Use parameterized queries to prevent SQL injection
   - Consider implementing query whitelisting

5. **Testing Strategy:**
   - Test with sample databases (create test MySQL/PostgreSQL instances)
   - Test LLM integration with various query types
   - Test connection handling edge cases

## Sample Database for Testing
Create a sample database with these tables:
- users (id, name, email, created_at)
- orders (id, user_id, total, status, created_at)  
- products (id, name, price, category)
- order_items (id, order_id, product_id, quantity, price)

This will give you good test data for JOIN queries and LLM generation testing.

Start with Phase 1 MVP and build incrementally. The LLM integration will be the most interesting part - make sure to test it thoroughly with various query types and schema complexities.

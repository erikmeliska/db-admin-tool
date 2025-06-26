import { GoogleGenerativeAI } from '@google/generative-ai';
import { DatabaseType, TableSchema } from '@/types/database';

const MODEL = "gemini-2.0-flash-lite";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export const generateQueryPrompt = (
  description: string,
  schema: TableSchema[],
  databaseType: DatabaseType
) => {
  const schemaDescription = schema.map(table => {
    const columns = table.columns.map(col => {
      let colDef = `  ${col.name} ${col.type}`;
      if (col.key === 'PRI') colDef += ' PRIMARY KEY';
      if (col.autoIncrement) colDef += ' AUTO_INCREMENT';
      if (!col.nullable) colDef += ' NOT NULL';
      if (col.default !== null && col.default !== undefined) colDef += ` DEFAULT ${col.default}`;
      return colDef;
    }).join('\n');

    const foreignKeys = table.foreignKeys?.map(fk => 
      `  FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencedTable}(${fk.referencedColumn})`
    ).join('\n') || '';

    return `
CREATE TABLE ${table.name} (
${columns}${foreignKeys ? '\n' + foreignKeys : ''}
);`;
  }).join('\n');

  return `You are an expert SQL developer. Generate a ${databaseType} query based on the user's request.

IMPORTANT: You must ONLY use the tables and columns provided in the schema below. Do NOT hallucinate or invent table names or column names that are not explicitly listed.

USER REQUEST: ${description}

DATABASE SCHEMA (${databaseType}):
${schemaDescription}

AVAILABLE TABLES: ${schema.map(t => t.name).join(', ')}

RULES:
1. ONLY use table names and column names that exist in the schema above
2. Use proper ${databaseType} SQL syntax
3. Include appropriate JOINs when working with multiple tables
4. Use foreign key relationships when joining tables
5. Add LIMIT clause for SELECT queries (LIMIT 100)
6. Return ONLY the SQL query, no explanations or comments
7. If the request cannot be fulfilled with the available schema, return: -- ERROR: Cannot generate query with available tables

SQL Query:`;
};

export async function generateSQLQuery(
  description: string,
  schema: TableSchema[],
  databaseType: DatabaseType
): Promise<string> {
  try {
    const prompt = generateQueryPrompt(description, schema, databaseType);
    
    const model = genAI.getGenerativeModel({ 
      model: MODEL,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 800,
      },
    });

    const systemInstruction = 'You are an expert SQL developer. You generate accurate SQL queries based on provided database schemas. You never hallucinate table names or column names that are not provided in the schema.';
    
    const fullPrompt = `${systemInstruction}\n\n${prompt}`;
    
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    let generatedQuery = response.text().trim();
    
    // Clean up markdown formatting from Gemini
    generatedQuery = generatedQuery
      .replace(/^```sql\s*/i, '')  // Remove opening ```sql
      .replace(/\s*```$/, '')      // Remove closing ```
      .trim();
    
    if (!generatedQuery) {
      throw new Error('No query generated');
    }

    return generatedQuery;
  } catch (error) {
    throw new Error(`Failed to generate SQL query: ${error}`);
  }
}

export function explainQuery(query: string, databaseType: DatabaseType): string {
  // Simple query explanation logic
  const lowerQuery = query.toLowerCase().trim();
  
  if (lowerQuery.startsWith('select')) {
    return `This is a SELECT query for ${databaseType} that retrieves data from the database.`;
  } else if (lowerQuery.startsWith('insert')) {
    return `This is an INSERT query for ${databaseType} that adds new data to the database.`;
  } else if (lowerQuery.startsWith('update')) {
    return `This is an UPDATE query for ${databaseType} that modifies existing data in the database.`;
  } else if (lowerQuery.startsWith('delete')) {
    return `This is a DELETE query for ${databaseType} that removes data from the database.`;
  } else {
    return `This is a ${databaseType} database query.`;
  }
} 
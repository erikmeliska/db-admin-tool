import { NextRequest, NextResponse } from 'next/server';
import { generateSQLQuery } from '@/lib/llm/query-generator';
import { DatabaseType, TableSchema } from '@/types/database';
import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL = "gemini-2.0-flash-lite";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      description, 
      schema, 
      databaseType,
      action = 'generate', // Default to generate for backward compatibility
      query, // For explain/fix/modify/ask actions
      apiKey // Google API key from client
    }: { 
      description: string; 
      schema: TableSchema[]; 
      databaseType: DatabaseType;
      action?: 'generate' | 'explain' | 'fix' | 'modify' | 'ask';
      query?: string;
      apiKey?: string;
    } = body;
    
    if (!description || !databaseType) {
      return NextResponse.json(
        { error: 'Description and database type are required' },
        { status: 400 }
      );
    }

    // Use provided API key or fallback to environment variable
    const googleApiKey = apiKey || process.env.GOOGLE_API_KEY;
    if (!googleApiKey) {
      return NextResponse.json(
        { error: 'Google API key not provided. Please configure it in Settings.' },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({ 
      model: MODEL,
      generationConfig: {
        temperature: action === 'explain' ? 0.3 : 0, // Slightly more creative for explanations
        maxOutputTokens: action === 'explain' ? 1000 : 800,
      },
    });

    let result: string;
    let responseData: { query?: string; explanation?: string };

    switch (action) {
      case 'generate':
        if (!schema) {
          return NextResponse.json(
            { error: 'Schema is required for query generation' },
            { status: 400 }
          );
        }
        result = await generateSQLQuery(description, schema, databaseType);
        responseData = { 
          query: result,
          explanation: `Generated ${databaseType} query based on: "${description}"`,
        };
        break;

      case 'explain':
        if (!query) {
          return NextResponse.json(
            { error: 'Query is required for explanation' },
            { status: 400 }
          );
        }
        
        const schemaContext = schema && schema.length > 0 
          ? schema.map(table => 
              `Table: ${table.name}\nColumns: ${table.columns.map((col: { name: string; type: string }) => `${col.name} (${col.type})`).join(', ')}`
            ).join('\n\n')
          : 'No schema information available';

        const explainPrompt = `You are an expert SQL analyst. Please explain this ${databaseType} query in simple, clear terms.

${schemaContext ? `Database Schema Context:\n${schemaContext}\n` : ''}
SQL Query:
${query}

Please provide a clear explanation that covers:
1. What data this query retrieves or modifies
2. Which tables and columns are involved
3. How the JOINs work (if any)
4. Any filtering conditions or grouping
5. The overall business purpose

Explain in plain English that a non-technical person could understand.`;

        const explainResponse = await model.generateContent(explainPrompt);
        result = (await explainResponse.response).text().trim();
        responseData = { explanation: result };
        break;

      case 'fix':
        if (!query) {
          return NextResponse.json(
            { error: 'Query is required for fixing' },
            { status: 400 }
          );
        }

        const fixSchemaContext = schema && schema.length > 0 
          ? schema.map(table => 
              `Table: ${table.name}\nColumns: ${table.columns.map((col: { name: string; type: string }) => `${col.name} (${col.type})`).join(', ')}`
            ).join('\n\n')
          : '';

        const fixPrompt = `You are an expert SQL developer. Please analyze and fix any issues in this ${databaseType} query.

${fixSchemaContext ? `Available Schema:\n${fixSchemaContext}\n` : ''}
Current Query:
${query}

Instructions:
${description}

Please identify and fix:
- Syntax errors
- Incorrect table or column names
- JOIN issues
- Logic errors
- Performance problems

Return ONLY the corrected SQL query, no explanations.`;

        const fixResponse = await model.generateContent(fixPrompt);
        result = (await fixResponse.response).text().trim()
          .replace(/^```sql\s*/i, '')
          .replace(/\s*```$/, '');
        responseData = { query: result };
        break;

      case 'modify':
        if (!query) {
          return NextResponse.json(
            { error: 'Query is required for modification' },
            { status: 400 }
          );
        }

        const modifySchemaContext = schema && schema.length > 0 
          ? schema.map(table => 
              `Table: ${table.name}\nColumns: ${table.columns.map((col: { name: string; type: string }) => `${col.name} (${col.type})`).join(', ')}`
            ).join('\n\n')
          : '';

        const modifyPrompt = `You are an expert SQL developer. Please modify this ${databaseType} query based on the user's request.

${modifySchemaContext ? `Available Schema:\n${modifySchemaContext}\n` : ''}
Current Query:
${query}

Modification Request:
${description}

Please return the modified SQL query that implements the requested changes. Return ONLY the SQL query, no explanations.`;

        const modifyResponse = await model.generateContent(modifyPrompt);
        result = (await modifyResponse.response).text().trim()
          .replace(/^```sql\s*/i, '')
          .replace(/\s*```$/, '');
        responseData = { query: result };
        break;

      case 'ask':
        if (!query) {
          return NextResponse.json(
            { error: 'Query is required for asking questions' },
            { status: 400 }
          );
        }

        const askSchemaContext = schema && schema.length > 0 
          ? schema.map(table => 
              `Table: ${table.name}\nColumns: ${table.columns.map((col: { name: string; type: string }) => `${col.name} (${col.type})`).join(', ')}`
            ).join('\n\n')
          : '';

        const askPrompt = `You are an expert SQL analyst. Please answer the user's question about this ${databaseType} query.

${askSchemaContext ? `Available Schema:\n${askSchemaContext}\n` : ''}
SQL Query:
${query}

User's Question:
${description}

Please provide a detailed, helpful answer about the query. Use markdown formatting for better readability.`;

        const askResponse = await model.generateContent(askPrompt);
        result = (await askResponse.response).text().trim();
        responseData = { explanation: result };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: generate, explain, fix, modify, or ask' },
          { status: 400 }
        );
    }
    
    return NextResponse.json(responseData);
  } catch (error) {
    return NextResponse.json(
      { error: `Operation failed: ${error}` },
      { status: 500 }
    );
  }
} 
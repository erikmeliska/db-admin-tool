import { NextRequest, NextResponse } from 'next/server';
import { generateSQLQuery } from '@/lib/llm/query-generator';
import { DatabaseType, TableSchema } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const { 
      description, 
      schema, 
      databaseType 
    }: { 
      description: string; 
      schema: TableSchema[]; 
      databaseType: DatabaseType;
    } = await request.json();
    
    if (!description || !schema || !databaseType) {
      return NextResponse.json(
        { error: 'Description, schema, and database type are required' },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'Google API key not configured' },
        { status: 500 }
      );
    }

    const generatedQuery = await generateSQLQuery(description, schema, databaseType);
    
    return NextResponse.json({ 
      query: generatedQuery,
      explanation: `Generated ${databaseType} query based on: "${description}"`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Query generation failed: ${error}` },
      { status: 500 }
    );
  }
} 
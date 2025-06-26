import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';

export async function POST(request: NextRequest) {
  try {
    const { query }: { query: string } = await request.json();
    const authHeader = request.headers.get('authorization');
    const sessionId = authHeader?.replace('Bearer ', '');
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Authorization header with session ID is required' },
        { status: 401 }
      );
    }

    // Validate session
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const connection = await sessionManager.getConnection(sessionId);
    await connection.connect();
    
    try {
      const result = await connection.executeQuery(query);
      await connection.disconnect();
      
      return NextResponse.json(result);
    } catch (queryError) {
      await connection.disconnect();
      throw queryError;
    }
  } catch (error) {
    return NextResponse.json(
      { error: `Query execution failed: ${error}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const tableName = searchParams.get('table');
    const authHeader = request.headers.get('authorization');
    const sessionId = authHeader?.replace('Bearer ', '');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Authorization header with session ID is required' },
        { status: 401 }
      );
    }

    // Validate session
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const connection = await sessionManager.getConnection(sessionId);
    await connection.connect();
    
    try {
      if (action === 'tables') {
        const tables = await connection.getTables();
        await connection.disconnect();
        return NextResponse.json({ tables });
      } else if (action === 'schema' && tableName) {
        const schema = await connection.getTableSchema(tableName);
        await connection.disconnect();
        return NextResponse.json({ schema });
      } else {
        await connection.disconnect();
        return NextResponse.json(
          { error: 'Invalid action or missing parameters' },
          { status: 400 }
        );
      }
    } catch (actionError) {
      await connection.disconnect();
      throw actionError;
    }
  } catch (error) {
    return NextResponse.json(
      { error: `Operation failed: ${error}` },
      { status: 500 }
    );
  }
} 
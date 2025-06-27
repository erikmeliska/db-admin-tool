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
    
    // Add timeout for query execution
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query execution timeout after 30 seconds')), 30000);
    });
    
    try {
      // console.log('Executing query for session:', sessionId);
      await connection.connect();
      const result = await Promise.race([
        connection.executeQuery(query),
        timeoutPromise
      ]);
      await connection.disconnect();
      // console.log('Query executed successfully');
      
      return NextResponse.json(result);
    } catch (queryError) {
      console.error('Query execution failed:', queryError);
      try {
        await connection.disconnect();
      } catch (disconnectError) {
        console.warn('Error during disconnect:', disconnectError);
      }
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
    
    // Add timeout for database operations
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database operation timeout after 30 seconds')), 30000);
    });
    
    try {
      if (action === 'tables') {
        // console.log('Fetching tables for session:', sessionId);
        await connection.connect();
        const tables = await Promise.race([
          connection.getTables(),
          timeoutPromise
        ]);
        await connection.disconnect();
        // console.log('Tables fetched successfully:', tables);
        return NextResponse.json({ tables });
      } else if (action === 'schema' && tableName) {
        // console.log('Fetching schema for table:', tableName);
        await connection.connect();
        const schema = await Promise.race([
          connection.getTableSchema(tableName),
          timeoutPromise
        ]);
        await connection.disconnect();
        // console.log('Schema fetched successfully for table:', tableName);
        return NextResponse.json({ schema });
      } else {
        return NextResponse.json(
          { error: 'Invalid action or missing parameters' },
          { status: 400 }
        );
      }
    } catch (actionError) {
      console.error('Database operation failed:', actionError);
      try {
        await connection.disconnect();
      } catch (disconnectError) {
        console.warn('Error during disconnect:', disconnectError);
      }
      throw actionError;
    }
  } catch (error) {
    return NextResponse.json(
      { error: `Operation failed: ${error}` },
      { status: 500 }
    );
  }
} 
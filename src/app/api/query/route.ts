import { NextRequest, NextResponse } from 'next/server';
import { connectionManager } from '@/lib/database/connections';
import { ConnectionConfig } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const { query, config }: { query: string; config: ConnectionConfig } = await request.json();
    
    if (!query || !config) {
      return NextResponse.json(
        { error: 'Query and connection config are required' },
        { status: 400 }
      );
    }

    const connection = connectionManager.createConnection(config);
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
    const configStr = searchParams.get('config');
    const tableName = searchParams.get('table');
    
    if (!configStr) {
      return NextResponse.json(
        { error: 'Connection config required' },
        { status: 400 }
      );
    }

    const config: ConnectionConfig = JSON.parse(configStr);
    const connection = connectionManager.createConnection(config);
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
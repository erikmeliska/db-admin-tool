import { NextRequest, NextResponse } from 'next/server';
import { connectionManager } from '@/lib/database/connections';
import { ConnectionConfig } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const config: ConnectionConfig = await request.json();
    
    // Test the connection
    const connection = connectionManager.createConnection(config);
    const isValid = await connection.testConnection();
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Failed to connect to database' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Connection successful' });
  } catch (error) {
    return NextResponse.json(
      { error: `Connection failed: ${error}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const configStr = searchParams.get('config');
    
    if (!configStr) {
      return NextResponse.json(
        { error: 'Connection config required' },
        { status: 400 }
      );
    }

    const config: ConnectionConfig = JSON.parse(configStr);
    const connection = connectionManager.createConnection(config);
    const isValid = await connection.testConnection();
    
    return NextResponse.json({ isValid });
  } catch (error) {
    return NextResponse.json(
      { error: `Test failed: ${error}` },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';

// Get cached table metadata
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const sessionId = authHeader?.replace('Bearer ', '');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Authorization header with session ID is required' },
        { status: 401 }
      );
    }

    // Validate session
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const metadata = await sessionManager.getTableMetadata(sessionId);
    
    return NextResponse.json({ metadata });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to get metadata: ${error}` },
      { status: 500 }
    );
  }
}

// Refresh table metadata
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const sessionId = authHeader?.replace('Bearer ', '');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Authorization header with session ID is required' },
        { status: 401 }
      );
    }

    // Validate session
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const metadata = await sessionManager.refreshTableMetadata(sessionId);
    
    return NextResponse.json({ metadata });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to refresh metadata: ${error}` },
      { status: 500 }
    );
  }
} 
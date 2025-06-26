import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import { ConnectionConfig } from '@/types/database';

// Create new session
export async function POST(request: NextRequest) {
  try {
    const config: ConnectionConfig = await request.json();
    
    if (!config || !config.name || !config.type) {
      return NextResponse.json(
        { error: 'Valid connection config is required' },
        { status: 400 }
      );
    }

    const session = await sessionManager.createSession(config);
    
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to create session: ${error}` },
      { status: 500 }
    );
  }
}

// Get active sessions
export async function GET() {
  try {
    const sessions = sessionManager.getActiveSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to get sessions: ${error}` },
      { status: 500 }
    );
  }
}

// Delete session
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const sessionId = authHeader?.replace('Bearer ', '');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Authorization header with session ID is required' },
        { status: 401 }
      );
    }

    const success = await sessionManager.destroySession(sessionId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to delete session: ${error}` },
      { status: 500 }
    );
  }
} 
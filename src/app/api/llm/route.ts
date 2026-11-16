import { NextRequest, NextResponse } from 'next/server';
import { runLLMAction, LLMAction, LLMRequest } from '@/lib/llm/query-generator';
import { bridgeHealth, LLMSelection } from '@/lib/llm/bridge';

const ACTIONS: LLMAction[] = ['generate', 'explain', 'fix', 'modify', 'ask'];

// Which local CLIs the bridge can reach (used by Settings).
export async function GET() {
  return NextResponse.json(await bridgeHealth());
}

// The route runs CLIs on the host, so only accept same-origin JSON requests:
// a cross-site page can't send application/json without a CORS preflight.
function isSameOriginJson(request: NextRequest): boolean {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return false;
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser client (curl), not a CSRF vector
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginJson(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { action = 'generate', description, databaseType, schema, query, llm } = body as Partial<LLMRequest> & {
      llm?: LLMSelection;
    };

    if (!description || !databaseType) {
      return NextResponse.json({ error: 'Description and database type are required' }, { status: 400 });
    }
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Must be one of: ${ACTIONS.join(', ')}` }, { status: 400 });
    }
    if (action === 'generate' && !schema) {
      return NextResponse.json({ error: 'Schema is required for query generation' }, { status: 400 });
    }
    if (action !== 'generate' && !query) {
      return NextResponse.json({ error: `Query is required for action "${action}"` }, { status: 400 });
    }

    const result = await runLLMAction({ action, description, databaseType, schema, query }, llm);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `Operation failed: ${error instanceof Error ? error.message : error}` },
      { status: 500 }
    );
  }
}

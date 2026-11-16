import { NextRequest, NextResponse } from 'next/server';
import { runLLMAction, LLMAction, LLMRequest } from '@/lib/llm/query-generator';
import { bridgeHealth, LLMSelection } from '@/lib/llm/bridge';

const ACTIONS: LLMAction[] = ['generate', 'explain', 'fix', 'modify', 'ask'];

// Which local CLIs the bridge can reach (used by Settings).
export async function GET() {
  return NextResponse.json(await bridgeHealth());
}

// The route runs CLIs on the host, so only accept JSON from the app itself on loopback.
// Host allowlist blocks DNS rebinding; JSON content type forces a CORS preflight cross-site.
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  try {
    return LOCAL_HOSTNAMES.has(new URL(`http://${host}`).hostname);
  } catch {
    return false;
  }
}

function isSameOriginJson(request: NextRequest): boolean {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return false;
  const host = request.headers.get('host');
  if (!isLocalHost(host)) return false;
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser client (curl), not a CSRF vector
  try {
    const o = new URL(origin);
    return LOCAL_HOSTNAMES.has(o.hostname) && o.host === host;
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

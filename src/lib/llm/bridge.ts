// Server-side client for the host LLM bridge (llm-bridge/server.mjs).
// The bridge runs the local, logged-in CLIs (claude, codex, agy).

export const LLM_PROVIDERS = ['claude', 'codex', 'antigravity'] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];

export interface LLMSelection {
  provider?: LLMProvider;
  model?: string;
}

function bridgeConfig() {
  const url = process.env.LLM_BRIDGE_URL || 'http://127.0.0.1:8787';
  const token = process.env.LLM_BRIDGE_TOKEN;
  if (!token) throw new Error('LLM_BRIDGE_TOKEN is not set on the server');
  return { url: url.replace(/\/$/, ''), token };
}

export function resolveSelection(selection?: LLMSelection): Required<Pick<LLMSelection, 'provider'>> & LLMSelection {
  const provider = selection?.provider ?? (process.env.LLM_DEFAULT_PROVIDER as LLMProvider) ?? 'claude';
  if (!LLM_PROVIDERS.includes(provider)) throw new Error(`Unknown LLM provider: ${provider}`);
  return { provider, model: selection?.model?.trim() || undefined };
}

export async function complete(prompt: string, selection?: LLMSelection): Promise<string> {
  const { url, token } = bridgeConfig();
  const { provider, model } = resolveSelection(selection);
  const response = await fetch(`${url}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ provider, model, prompt }),
  });
  const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok) throw new Error(data.error || `LLM bridge returned ${response.status}`);
  if (!data.text) throw new Error(`${provider} returned an empty answer`);
  return data.text;
}

export async function bridgeHealth(): Promise<{ ok: boolean; providers?: Record<LLMProvider, boolean>; error?: string }> {
  try {
    const { url, token } = bridgeConfig();
    const response = await fetch(`${url}/health`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return { ok: false, error: `bridge returned ${response.status}` };
    return await response.json();
  } catch (error) {
    return { ok: false, error: String(error instanceof Error ? error.message : error) };
  }
}

export function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

// Browser-side LLM selection, stored in localStorage and sent with every /api/llm call.
import type { LLMProvider, LLMSelection } from './providers';

const PROVIDER_KEY = 'llm-provider';
const MODEL_KEY = 'llm-model';

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  claude: 'Claude Code CLI',
  codex: 'Codex CLI',
  antigravity: 'Antigravity CLI (agy)',
};

export function getLLMSettings(): LLMSelection {
  try {
    const provider = (localStorage.getItem(PROVIDER_KEY) as LLMProvider) || 'claude';
    const model = localStorage.getItem(MODEL_KEY) || undefined;
    return { provider, model };
  } catch {
    return { provider: 'claude' };
  }
}

export function setLLMSettings({ provider, model }: LLMSelection) {
  try {
    if (provider) localStorage.setItem(PROVIDER_KEY, provider);
    if (model?.trim()) localStorage.setItem(MODEL_KEY, model.trim());
    else localStorage.removeItem(MODEL_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function describeLLM(selection: LLMSelection = getLLMSettings()): string {
  return `${selection.provider ?? 'claude'}${selection.model ? `/${selection.model}` : ''}`;
}

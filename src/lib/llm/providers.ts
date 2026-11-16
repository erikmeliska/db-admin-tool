// Shared (client + server) LLM provider types.
export const LLM_PROVIDERS = ['claude', 'codex', 'antigravity'] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];

export interface LLMSelection {
  provider?: LLMProvider;
  model?: string;
}

// Desktop app: GUI processes don't inherit shell exports, so read the MySQL proxy
// creds straight from ~/.secrets (or $SECRETS_FILE) when they aren't in the env.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const KEYS = ['IM_DB_PROXY_URL', 'IM_DB_PROXY_AUTH'] as const;
let loaded = false;

function unquote(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

export function loadLocalSecrets(): void {
  if (loaded) return;
  loaded = true;
  if (KEYS.every((k) => process.env[k])) return;
  const file = process.env.SECRETS_FILE || join(homedir(), '.secrets');
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)=(.*)$/);
    if (m && (KEYS as readonly string[]).includes(m[1]) && !process.env[m[1]]) {
      process.env[m[1]] = unquote(m[2]);
    }
  }
}

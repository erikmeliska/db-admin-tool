// Server-side: runs the local, logged-in AI CLIs (claude, codex, agy) directly.
// Each call runs in a throw-away empty directory with tools disabled / sandboxed,
// so the model only answers text.
import { spawn } from 'node:child_process';
import { accessSync, constants, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { LLM_PROVIDERS, LLMProvider, LLMSelection } from './providers';

const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 180_000);
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:\/-]{0,79}$/;
const BIN_NAMES: Record<LLMProvider, string> = { claude: 'claude', codex: 'codex', antigravity: 'agy' };

// GUI apps start with a minimal PATH, so also look in the usual install locations.
function searchPath(): string[] {
  const home = homedir();
  return [
    ...(process.env.PATH || '').split(delimiter),
    join(home, '.local', 'bin'),
    join(home, '.npm-global', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ].filter(Boolean);
}

function findBin(provider: LLMProvider): string | null {
  const override = process.env[`${provider.toUpperCase()}_BIN`];
  if (override) return override;
  for (const dir of searchPath()) {
    const candidate = join(dir, BIN_NAMES[provider]);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      /* next */
    }
  }
  return null;
}

// Children get only what the CLIs need to find their login.
function childEnv(): Record<string, string> {
  const env: Record<string, string> = { PATH: searchPath().join(delimiter) };
  for (const k of ['HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LC_ALL', 'TMPDIR', 'TERM']) {
    const v = process.env[k];
    if (v !== undefined) env[k] = v;
  }
  return env;
}

function buildArgs(provider: LLMProvider, prompt: string, model: string | undefined, workdir: string) {
  switch (provider) {
    case 'claude':
      return {
        args: [
          '-p', '--output-format', 'text', '--tools', '', '--no-session-persistence',
          '--setting-sources', '', '--strict-mcp-config', ...(model ? ['--model', model] : []),
        ],
        stdin: prompt,
      };
    case 'codex': {
      const outputFile = join(workdir, 'last-message.txt');
      return {
        args: [
          'exec', '--skip-git-repo-check', '--ephemeral', '--sandbox', 'read-only', '--color', 'never',
          '-o', outputFile, ...(model ? ['-m', model] : []), '-',
        ],
        stdin: prompt,
        outputFile,
      };
    }
    case 'antigravity':
      return {
        args: [
          '--sandbox', '--disable-slash-commands', '--output-format', 'text',
          '--print-timeout', `${Math.floor(TIMEOUT_MS / 1000)}s`, ...(model ? ['--model', model] : []),
          '-p', prompt,
        ],
        stdin: '',
      };
  }
}

export function resolveSelection(selection?: LLMSelection): { provider: LLMProvider; model?: string } {
  const provider = selection?.provider ?? (process.env.LLM_DEFAULT_PROVIDER as LLMProvider) ?? 'claude';
  if (!LLM_PROVIDERS.includes(provider)) throw new Error(`Unknown LLM provider: ${provider}`);
  const model = selection?.model?.trim() || undefined;
  if (model && !MODEL_RE.test(model)) throw new Error(`Invalid model name: ${model}`);
  return { provider, model };
}

export function complete(prompt: string, selection?: LLMSelection): Promise<string> {
  const { provider, model } = resolveSelection(selection);
  const bin = findBin(provider);
  if (!bin) return Promise.reject(new Error(`CLI "${BIN_NAMES[provider]}" not found. Install it and log in.`));

  return new Promise((resolve, reject) => {
    const workdir = mkdtempSync(join(tmpdir(), 'db-admin-llm-'));
    const cmd = buildArgs(provider, prompt, model, workdir);
    const cleanup = () => rmSync(workdir, { recursive: true, force: true });
    const child = spawn(bin, cmd.args, { cwd: workdir, env: childEnv() as unknown as NodeJS.ProcessEnv, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      cleanup();
      reject(e);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      let text = stdout;
      if (cmd.outputFile) {
        try {
          text = readFileSync(cmd.outputFile, 'utf8');
        } catch {
          /* fall back to stdout */
        }
      }
      cleanup();
      if (code !== 0) {
        const why = signal ? `killed by ${signal} (timeout ${TIMEOUT_MS} ms?)` : `exit ${code}`;
        return reject(new Error(`${provider} ${why}: ${(stderr || stdout).trim().slice(-800)}`));
      }
      if (!text.trim()) return reject(new Error(`${provider} returned an empty answer`));
      resolve(text.trim());
    });
    child.stdin.end(cmd.stdin);
  });
}

export function providersAvailable(): { ok: boolean; providers: Record<LLMProvider, boolean> } {
  const providers = Object.fromEntries(LLM_PROVIDERS.map((p) => [p, Boolean(findBin(p))])) as Record<LLMProvider, boolean>;
  return { ok: Object.values(providers).some(Boolean), providers };
}

export function stripCodeFence(text: string): string {
  return text.trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
}

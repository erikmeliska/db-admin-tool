#!/usr/bin/env node
// Host-side LLM bridge: lets the containerised app use the local, already
// logged-in AI CLIs (claude, codex, agy/Antigravity) instead of an API key.
//
//   GET  /health     -> { ok, providers: { claude: bool, codex: bool, antigravity: bool } }
//   POST /complete   -> { provider, prompt, model? }  =>  { text }
//   POST /shutdown   -> stops the bridge (used by scripts/local-down.sh)
//
// Every request must carry `Authorization: Bearer $LLM_BRIDGE_TOKEN`.
// No dependencies: run with plain `node llm-bridge/server.mjs`.

import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.LLM_BRIDGE_PORT || 8787);
const HOST = process.env.LLM_BRIDGE_HOST || '127.0.0.1';
const TOKEN = process.env.LLM_BRIDGE_TOKEN || '';
const TIMEOUT_MS = Number(process.env.LLM_BRIDGE_TIMEOUT_MS || 180_000);
const MAX_BODY = 5 * 1024 * 1024;

if (!TOKEN) {
  console.error('LLM_BRIDGE_TOKEN is required');
  process.exit(1);
}

function which(bin) {
  try {
    return execFileSync('/bin/sh', ['-lc', `command -v ${bin}`], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

const BINS = {
  claude: process.env.CLAUDE_BIN || which('claude'),
  codex: process.env.CODEX_BIN || which('codex'),
  antigravity: process.env.AGY_BIN || which('agy'),
};

// Each provider runs in a throw-away empty directory, without tools, so the
// model only answers text and never touches files.
function buildCommand(provider, prompt, model, workdir) {
  switch (provider) {
    case 'claude':
      return {
        bin: BINS.claude,
        args: [
          '-p', '--output-format', 'text', '--tools', '', '--no-session-persistence',
          '--setting-sources', '', '--strict-mcp-config',
          ...(model ? ['--model', model] : []),
        ],
        stdin: prompt,
      };
    case 'codex': {
      const out = join(workdir, 'last-message.txt');
      return {
        bin: BINS.codex,
        args: [
          'exec', '--skip-git-repo-check', '--ephemeral', '--sandbox', 'read-only',
          '--color', 'never', '-o', out, ...(model ? ['-m', model] : []), '-',
        ],
        stdin: prompt,
        outputFile: out,
      };
    }
    case 'antigravity':
      return {
        bin: BINS.antigravity,
        args: [
          '-p', prompt, '--output-format', 'text', '--print-timeout', `${Math.floor(TIMEOUT_MS / 1000)}s`,
          ...(model ? ['--model', model] : []),
        ],
        stdin: '',
      };
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function run(provider, prompt, model) {
  return new Promise((resolve, reject) => {
    const workdir = mkdtempSync(join(tmpdir(), 'llm-bridge-'));
    const cleanup = () => rmSync(workdir, { recursive: true, force: true });
    let cmd;
    try {
      cmd = buildCommand(provider, prompt, model, workdir);
    } catch (e) {
      cleanup();
      return reject(e);
    }
    if (!cmd.bin) {
      cleanup();
      return reject(new Error(`CLI for provider "${provider}" not found on host`));
    }

    const child = spawn(cmd.bin, cmd.args, { cwd: workdir, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
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
      resolve(text.trim());
    });
    child.stdin.end(cmd.stdin);
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'unauthorized' });

  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, {
      ok: true,
      providers: Object.fromEntries(Object.entries(BINS).map(([k, v]) => [k, Boolean(v)])),
    });
  }

  if (req.method === 'POST' && req.url === '/shutdown') {
    send(res, 200, { ok: true });
    console.log('[llm-bridge] shutdown requested');
    server.close(() => process.exit(0));
    return;
  }

  if (req.method === 'POST' && req.url === '/complete') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) req.destroy();
    });
    req.on('end', async () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        return send(res, 400, { error: 'invalid JSON' });
      }
      const { provider, prompt, model } = payload;
      if (!provider || !prompt) return send(res, 400, { error: 'provider and prompt are required' });
      const started = Date.now();
      try {
        const text = await run(provider, prompt, model);
        console.log(`[llm-bridge] ${provider}${model ? `/${model}` : ''} ok in ${Date.now() - started} ms`);
        send(res, 200, { text });
      } catch (e) {
        console.error(`[llm-bridge] ${provider} failed:`, e.message);
        send(res, 502, { error: e.message });
      }
    });
    return;
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`[llm-bridge] listening on http://${HOST}:${PORT}`, BINS);
});

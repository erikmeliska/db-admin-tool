# Database Admin Tool

A local, AI-assisted database administration tool. Runs as a **native macOS desktop app** (Tauri + bundled Node + Next.js) and uses your **logged-in AI CLIs** (Claude Code, Codex, Antigravity) instead of API keys.

![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)
![macOS](https://img.shields.io/badge/macOS-arm64-lightgrey.svg)

## ✨ Features

- **Databases**: MySQL, PostgreSQL, SQLite, and **MySQL Proxy** (HTTP proxy API, e.g. InteliMail `dbproxy`)
- **AI without API keys**: natural language → SQL, explain / fix / modify a query, ask about a query; runs `claude`, `codex` or `agy` on your machine
- **SQL editor**: CodeMirror with SQL highlighting, table/column autocomplete, multiple tabs, Ctrl+Enter to run
- **Explorer**: tables with row count and size, schemas loaded on demand, JSON cells rendered interactively
- **History**: separate SQL and AI-prompt history with search, "run" and "run in new tab"
- **Sessions**: credentials sent once, then stored server-side AES-encrypted; 24 h expiry, manual revoke
- **Settings (⚙️)**: AI provider + model, theme (light/dark/system), storage cleanup

## 🚀 Quick start

### Desktop app (recommended, macOS arm64)

```bash
./scripts/build-desktop.sh --install   # builds DB Admin Tool.app + .dmg and copies the app to /Applications
open "/Applications/DB Admin Tool.app"
```

Build needs Node 20+, Rust (`brew install rust`) and Xcode Command Line Tools. The finished app is self-contained (it bundles Node), so on the target Mac you only need the AI CLIs.

| | |
|---|---|
| Output | `desktop/src-tauri/target/release/bundle/macos/DB Admin Tool.app` (≈170 MB), `bundle/dmg/*.dmg` (≈53 MB) |
| Server | `127.0.0.1:18008`, started on launch and stopped on quit (falls back to a free port if 18008 is taken) |
| Data | `~/Library/Application Support/sk.trisoft.dbadmintool/` (`sessions/`, `server.log`) |
| Signing | ad-hoc (local use); other Macs need an Apple Developer ID + notarization |

### Local development

```bash
npm install
npm run dev          # http://localhost:3000
```

Optional env vars are in `.env.example`. Without them, the dev server still reads the MySQL proxy creds from `~/.secrets` and finds the AI CLIs on `PATH`.

### Docker (server mode, no AI)

```bash
docker build -t db-admin-tool .
docker run -d -p 127.0.0.1:8008:8008 -v ./sessions:/app/sessions db-admin-tool
```

The container works for databases, but AI features are unavailable because the AI CLIs live on the host. CI still publishes multi-arch images to `ghcr.io/erikmeliska/db-admin-tool`.

## 🔧 Configuration

### AI provider

⚙️ Settings → **AI Provider** lets you choose:

| CLI | Binary | Model examples (optional) |
|---|---|---|
| Claude Code | `claude` | `sonnet`, `opus`, `haiku` |
| Codex | `codex` | any id accepted by `codex -m` |
| Antigravity | `agy` | see `agy models` |

Settings shows whether the selected CLI is installed. The CLI must already be logged in; the app does no login.

Each request runs the CLI non-interactively in an empty temp directory, with a minimal environment and tools disabled or sandboxed:
- `claude -p --tools ""`
- `codex exec --sandbox read-only`
- `agy -p --sandbox`

> Codex's read-only sandbox still lets the model *read* files. If that matters, use Claude, which has no tools at all.

### MySQL proxy credentials

Put these in `~/.secrets` (or point `SECRETS_FILE` at another file), in shell format:

```bash
export IM_DB_PROXY_URL=https://…/dbproxy/
export IM_DB_PROXY_AUTH="Basic …"     # the full Authorization header value
```

In the connection form choose **MySQL Proxy** and fill in only the **database name**. Leave proxy URL, username and password empty to use the creds above. **MySQL Server** defaults to the first two characters of the database name.

The env creds are used only as a pair. If you type a proxy URL, you also have to type its username and password; the server never sends `IM_DB_PROXY_AUTH` to a URL entered in the form.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `IM_DB_PROXY_URL`, `IM_DB_PROXY_AUTH` | read from `~/.secrets` | MySQL proxy endpoint and Authorization header |
| `SECRETS_FILE` | `~/.secrets` | where to read the proxy creds from |
| `LLM_DEFAULT_PROVIDER` | `claude` | CLI used when the client sends none |
| `LLM_TIMEOUT_MS` | `180000` | per-request CLI timeout |
| `CLAUDE_BIN`, `CODEX_BIN`, `ANTIGRAVITY_BIN` | auto-detected | explicit CLI paths |
| `SESSIONS_DIR` | `./sessions` | encrypted session storage (the desktop app uses Application Support) |
| `SESSION_ENCRYPTION_KEY` | generated into `$SESSIONS_DIR/.encryption-key` | AES key for stored sessions |
| `APP_TOKEN` | set by the desktop shell | per-launch secret, see Security |

## 🏗️ Architecture

```
DB Admin Tool.app
├── MacOS/db-admin-tool     Tauri shell (Rust, system WebKit window, ~3 MB)
├── MacOS/node              bundled Node runtime
└── Resources/server/       Next.js standalone server (UI + API routes)
        ├── /api/sessions, /api/query, /api/metadata  → mysql2 / pg / better-sqlite3 / HTTP proxy
        └── /api/llm                                   → spawns claude | codex | agy
```

On launch, the shell:
1. generates a random per-launch token;
2. starts Node with `APP_TOKEN` on `127.0.0.1:18008`;
3. checks that the server answers `HMAC(token, nonce)` for a fresh nonce, so a process squatting on the port is never trusted;
4. opens the window at `/?launch=<token>`, which sets an httpOnly cookie.

## 🔒 Security

- **Loopback only**: every request must have a `localhost` / `127.0.0.1` Host (blocks DNS rebinding) and, from a browser, a same-origin `Origin` (blocks CSRF).
- **Per-launch token** (desktop): with `APP_TOKEN` set, every path requires the token cookie or the `X-App-Token` header (fail-closed). The only exception is the HMAC handshake endpoint, which reveals nothing without the token. Other local processes and web pages can't use the app's API.
- **AI**: `/api/llm` accepts only `application/json`, model names are validated, and the CLIs run without tools or sandboxed in a throw-away directory.
- **Credentials**: sent once at session creation, stored server-side AES-encrypted, never returned to the client. Sessions expire after 24 h.
- **Build**: `.env` and `sessions/` are stripped from the app bundle and excluded from the Docker context.

## 🛠️ Development

### Project structure

```
desktop/                      Tauri shell (Cargo.toml, tauri.conf.json, src/main.rs, icons, entitlements)
scripts/build-desktop.sh      builds the desktop app (--install copies it to /Applications)
src/
├── middleware.ts             loopback / origin / per-launch token guard
├── app/api/
│   ├── sessions, query, metadata   database sessions and queries
│   ├── llm                         AI actions (generate, explain, fix, modify, ask)
│   ├── config                      non-secret capabilities (proxy creds available?)
│   └── launch-check                HMAC handshake for the desktop shell
├── components/               UI (QueryEditor, LLMQueryGenerator, SettingsDialog, …)
└── lib/
    ├── llm/cli.ts            runs the local AI CLIs
    ├── llm/query-generator.ts prompts per action
    ├── local-secrets.ts      reads IM_DB_PROXY_* from ~/.secrets
    ├── session-manager.ts    AES-encrypted session persistence
    └── database/             MySQL, MySQL proxy, PostgreSQL, SQLite drivers
```

### Checks

```bash
npx tsc --noEmit
npx eslint src
(cd desktop/src-tauri && cargo check)
```

### Changelog

**v3.0.0: local desktop app**
- Native macOS app (Tauri 2 + bundled Node) replaces the container setup
- AI runs through local Claude Code / Codex / Antigravity CLIs; Gemini and API keys removed
- MySQL proxy creds come from `~/.secrets`; proxy server defaults from the DB name
- Per-launch token, HMAC handshake, loopback/origin guard
- Fix: "Fix query" crashed on an undefined `setTabs`

**v2.x**: Settings dialog, table metadata and on-demand schemas, history actions and storage cleanup, session-based security, multi-tab editor.

## 📄 License

MIT

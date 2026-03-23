# Security Model

## Trust boundary

This is a **local, single-player game**. The Express server binds to **127.0.0.1 only** (loopback) and is not reachable from the network. The trust model is:

> Any process running as the current OS user on this machine is trusted.

This is the same trust level as any local CLI tool that reads `~/.config` or `~/.env` files.

## API key handling

- The Anthropic API key is stored **in server memory only** — it never enters the browser.
- It can be loaded from `.env` at startup, or set at runtime via the in-game UI.
- The key is sent only to `api.anthropic.com` over HTTPS. It is not logged or written to disk (unless present in `.env`).
- If the key is rejected by Anthropic (401), the server clears it from memory automatically.

## Session token

A random session token is generated at server startup and required on all `/api/*` requests (except the token fetch itself). This prevents **accidental** cross-origin or cross-tab access but does **not** prevent a determined local process from obtaining the token via `GET /api/token` and replaying it. This is acceptable given the loopback-only trust model above.

## Request validation

The `/api/chat` proxy enforces:
- **Model allowlist** — only specific Claude models are permitted.
- **Max response tokens** — capped at 512 per call.
- **Payload size** — `express.json` rejects bodies over 256 KB.
- **Shape validation** — system prompt (max 8000 chars), messages array (1–50 items), each message must have a valid role and content string (max 16000 chars).

These limits constrain the proxy to game-shaped requests but do not fully prevent arbitrary prompt content. A local process that obtains the session token can still send custom prompts within these size limits.

## What this does NOT protect against

- **Malicious local processes** — any process running as the same OS user can read `.env`, inspect server memory, or call the API endpoints. This is inherent to any local server.
- **Arbitrary prompt content** — the server validates request shape and size, but does not construct prompts server-side. The browser sends full prompt text.

## Recommendations for users

- Use an API key with **low spend limits** set in the [Anthropic console](https://console.anthropic.com/settings/limits).
- **Revoke the key** when you're done playing, or remove it from `.env`.
- Do not expose port 3000 via tunnels, port forwarding, or reverse proxies.

## Content Security Policy

The server sets strict CSP headers:
- `default-src 'self'` — no external resources.
- `script-src 'self'` — only scripts served by the game server can execute.
- `style-src 'self' 'unsafe-inline'` — inline styles allowed (game UI).
- No `connect-src` override needed — `default-src 'self'` covers it since the browser only talks to the local server.

All LLM output is rendered via `textContent` or canvas `fillText()` — never `innerHTML` with untrusted data.

// Browser → local server → Anthropic API.
// The API key never enters the browser. All requests are proxied through the game server.
// A session token (fetched once on load) authenticates requests to the local server.

const ALLOWED_MODELS = new Set([
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6',
    'claude-opus-4-6',
]);

let sessionToken = null;

async function ensureToken() {
    if (!sessionToken) {
        const res = await fetch('/api/token');
        const data = await res.json();
        sessionToken = data.token;
    }
    return sessionToken;
}

export default class LLMClient {
    // Fetch wrapper that injects the session token header.
    static async _fetch(url, options = {}) {
        const token = await ensureToken();
        options.headers = {
            ...options.headers,
            'x-session-token': token,
        };
        return fetch(url, options);
    }

    // Check whether the server has an API key configured.
    static async getStatus() {
        try {
            const res = await LLMClient._fetch('/api/status');
            return await res.json();
        } catch {
            return { ok: false, message: 'Cannot reach game server.' };
        }
    }

    // Send a key to the server for validation and storage.
    // Returns { ok, message?, model? }
    static async setKey(rawKey) {
        try {
            const res = await LLMClient._fetch('/api/key', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ key: rawKey }),
            });
            return await res.json();
        } catch {
            return { ok: false, message: 'Cannot reach game server.' };
        }
    }

    // Ask the server to forget the API key.
    static async removeKey() {
        try {
            await LLMClient._fetch('/api/key', { method: 'DELETE' });
        } catch { /* best-effort */ }
    }

    static async chat({ systemPrompt, messages, model = 'claude-haiku-4-5-20251001' }) {
        if (!ALLOWED_MODELS.has(model)) throw new Error(`Model not allowed: ${model}`);

        const res = await LLMClient._fetch('/api/chat', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ systemPrompt, messages, model }),
        });

        const data = await res.json().catch(() => null);
        if (!data) throw new Error('Failed to parse server response.');

        if (!res.ok) {
            throw new Error(data.error || `Server error (HTTP ${res.status}).`);
        }

        if (!data.content || data.content.length === 0) {
            throw new Error(`Empty response from API (stop_reason: ${data.stop_reason ?? 'unknown'}).`);
        }
        const text = data.content[0].text;
        if (typeof text !== 'string') {
            throw new Error(`Unexpected content type "${data.content[0].type}" — expected text.`);
        }
        return {
            text,
            usage: data.usage || null,
            model: data.model || null,
        };
    }
}

// Direct browser → Anthropic API (BYOK).
// The key is stored in localStorage and sent directly to api.anthropic.com.
// It never touches the game server.

const ALLOWED_MODELS = new Set([
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6',
    'claude-opus-4-6',
]);

const API_URL = 'https://api.anthropic.com/v1/messages';
const LS_KEY = 'philosopher_api_key';

export default class LLMClient {
    static getKey() {
        return localStorage.getItem(LS_KEY) || null;
    }

    static removeKey() {
        localStorage.removeItem(LS_KEY);
    }

    // Validates format, verifies with a real API call, then saves.
    // Returns { ok, message?, model? }
    static async setKey(rawKey) {
        const key = (rawKey || '').trim();
        if (!key) {
            return { ok: false, message: 'No key provided.' };
        }
        if (!key.startsWith('sk-ant-')) {
            return { ok: false, message: 'Key should start with sk-ant-…' };
        }
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-allow-browser': 'true',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'hi' }],
                }),
            });
            if (res.status === 401) return { ok: false, message: 'Invalid API key.' };
            if (!res.ok) return { ok: false, message: `Anthropic error (${res.status})` };
        } catch {
            return { ok: false, message: 'Network error — check connection.' };
        }
        localStorage.setItem(LS_KEY, key);
        return { ok: true, model: 'claude-haiku-4-5-20251001' };
    }

    // Returns { ok, message?, model? } — no network call.
    static async getStatus() {
        const key = LLMClient.getKey();
        if (!key) return { ok: false, message: 'No API key — click ⚙ to add one' };
        return { ok: true, model: 'claude-haiku-4-5-20251001' };
    }

    static async chat({ systemPrompt, messages, model = 'claude-haiku-4-5-20251001' }) {
        const key = LLMClient.getKey();
        if (!key) throw new Error('No API key — open ⚙ Settings to add one');
        if (!ALLOWED_MODELS.has(model)) throw new Error(`Model not allowed: ${model}`);

        const res = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-allow-browser': 'true',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model,
                max_tokens: 512,  // caps cost per call
                system: systemPrompt,
                messages,
            }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error('Invalid API key — open ⚙ Settings to update it');
        if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
        return data.content[0].text;
    }
}

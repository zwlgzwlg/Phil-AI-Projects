import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const OPENAI_API = 'https://api.openai.com/v1/responses';

// Model → provider mapping (replaces the old ALLOWED_MODELS set)
const MODEL_PROVIDER = {
    'claude-haiku-4-5-20251001': 'anthropic',
    'claude-sonnet-4-6':         'anthropic',
    'claude-opus-4-6':           'anthropic',
    'gpt-5.4-mini':              'openai',
    'gpt-5.4-nano':              'openai',
};

const MAX_TOKENS = 512;

// JSON Schema for OpenAI structured outputs — mirrors PromptBuilder's response format
const NPC_DECISION_SCHEMA = {
    type: 'object',
    properties: {
        moveTo: {
            anyOf: [
                {
                    type: 'object',
                    properties: { col: { type: 'number' }, row: { type: 'number' } },
                    required: ['col', 'row'],
                    additionalProperties: false,
                },
                { type: 'null' },
            ],
        },
        action: {
            anyOf: [
                {
                    type: 'object',
                    properties: {
                        type: { type: 'string' },
                        message: { type: 'string' },
                        targetId: { type: 'string' },
                        itemId: { type: 'string' },
                        itemIndex: { type: 'number' },
                        name: { type: 'string' },
                    },
                    required: ['type'],
                    additionalProperties: false,
                },
                { type: 'null' },
            ],
        },
        bonusAction: {
            anyOf: [
                {
                    type: 'object',
                    properties: {
                        type: { type: 'string' },
                        itemIndex: { type: 'number' },
                        slot: { type: 'string' },
                    },
                    required: ['type'],
                    additionalProperties: false,
                },
                { type: 'null' },
            ],
        },
        scheme: { type: 'string' },
    },
    required: ['moveTo', 'action', 'bonusAction', 'scheme'],
    additionalProperties: false,
};

// API keys live here in server memory — never sent to the browser.
const apiKeys = {
    anthropic: process.env.ANTHROPIC_API_KEY || null,
    openai: process.env.OPENAI_API_KEY || null,
};

// Cumulative token usage — persists across page refreshes (resets on server restart)
const tokenUsage = { input: 0, output: 0 };

// Session token — generated at startup, required on all /api/* requests.
// This is a speed bump, not a hard boundary: any local process can fetch /api/token
// and replay it. The real security boundary is the loopback bind (127.0.0.1) which
// prevents network exposure. See SECURITY.md for the full trust model.
const SESSION_TOKEN = crypto.randomBytes(32).toString('hex');

// Default models per provider (used when reporting status)
const DEFAULT_MODELS = {
    anthropic: 'claude-haiku-4-5-20251001',
    openai: 'gpt-5.4-nano',
};

// --- Provider adapter functions ---
// Both return: { text, usage: { input, output }, model, stopReason }

async function callAnthropic({ apiKey, model, systemPrompt, messages, maxTokens }) {
    const apiRes = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages,
        }),
    });

    const data = await apiRes.json().catch(() => null);
    if (!data) throw { status: 502, message: 'Invalid response from Anthropic API.' };

    if (apiRes.status === 401) {
        apiKeys.anthropic = null;
        throw { status: 401, message: 'API key rejected by Anthropic — please set a new one.' };
    }
    if (!apiRes.ok) {
        throw {
            status: apiRes.status,
            message: data.error?.message || `Anthropic API error (HTTP ${apiRes.status}).`,
        };
    }

    const text = data.content?.[0]?.text;
    if (typeof text !== 'string') {
        throw { status: 502, message: 'Unexpected response shape from Anthropic.' };
    }

    return {
        text,
        usage: {
            input: data.usage?.input_tokens || 0,
            output: data.usage?.output_tokens || 0,
        },
        model: data.model || model,
        stopReason: data.stop_reason || 'unknown',
    };
}

async function callOpenAI({ apiKey, model, systemPrompt, messages, maxTokens }) {
    const apiRes = await fetch(OPENAI_API, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            instructions: systemPrompt,
            input: messages.map(m => ({ role: m.role, content: m.content })),
            text: {
                format: {
                    type: 'json_schema',
                    name: 'npc_decision',
                    strict: true,
                    schema: NPC_DECISION_SCHEMA,
                },
            },
            max_output_tokens: maxTokens,
        }),
    });

    const data = await apiRes.json().catch(() => null);
    if (!data) throw { status: 502, message: 'Invalid response from OpenAI API.' };

    if (apiRes.status === 401) {
        apiKeys.openai = null;
        throw { status: 401, message: 'API key rejected by OpenAI — please set a new one.' };
    }
    if (!apiRes.ok) {
        throw {
            status: apiRes.status,
            message: data.error?.message || `OpenAI API error (HTTP ${apiRes.status}).`,
        };
    }

    // Responses API: output[0].content[0].text
    const text = data.output?.[0]?.content?.[0]?.text;
    if (typeof text !== 'string') {
        throw { status: 502, message: 'Unexpected response shape from OpenAI.' };
    }

    return {
        text,
        usage: {
            input: data.usage?.input_tokens || 0,
            output: data.usage?.output_tokens || 0,
        },
        model: data.model || model,
        stopReason: data.status === 'completed' ? 'end_turn' : (data.status || 'unknown'),
    };
}

// --- Express app ---

const app = express();

app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

app.use(express.json({ limit: '256kb' }));

// --- API routes (all under /api) ---

// Token endpoint — must be registered BEFORE the auth middleware.
// The browser fetches this once on load to get the session token.
app.get('/api/token', (req, res) => {
    res.json({ token: SESSION_TOKEN });
});

// Auth middleware — all subsequent /api/* routes require a valid session token.
app.use('/api', (req, res, next) => {
    if (req.headers['x-session-token'] !== SESSION_TOKEN) {
        return res.status(403).json({ error: 'Invalid or missing session token.' });
    }
    next();
});

// Check which providers are configured (never reveals keys)
app.get('/api/status', (req, res) => {
    const providers = {};
    if (apiKeys.anthropic) providers.anthropic = true;
    if (apiKeys.openai) providers.openai = true;

    if (Object.keys(providers).length > 0) {
        const defaultProvider = apiKeys.anthropic ? 'anthropic' : 'openai';
        res.json({ ok: true, model: DEFAULT_MODELS[defaultProvider], providers });
    } else {
        res.json({ ok: false, message: 'No API key configured — click \u2699 to add one.' });
    }
});

// Set or update an API key (validated before accepting)
app.post('/api/key', async (req, res) => {
    const key = (req.body.key || '').trim();
    const provider = req.body.provider || 'anthropic';

    if (!key) return res.json({ ok: false, message: 'No key provided.' });
    if (!['anthropic', 'openai'].includes(provider)) {
        return res.json({ ok: false, message: 'Invalid provider.' });
    }

    if (provider === 'anthropic') {
        if (!key.startsWith('sk-ant-')) return res.json({ ok: false, message: 'Key should start with sk-ant-\u2026' });

        try {
            const check = await fetch(ANTHROPIC_API, {
                method: 'POST',
                headers: {
                    'x-api-key': key,
                    'anthropic-version': ANTHROPIC_VERSION,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'hi' }],
                }),
            });
            if (check.status === 401) return res.json({ ok: false, message: 'Invalid API key.' });
            if (!check.ok) return res.json({ ok: false, message: `Anthropic error (${check.status}).` });
        } catch {
            return res.json({ ok: false, message: 'Network error — could not reach Anthropic.' });
        }

        apiKeys.anthropic = key;
        res.json({ ok: true, model: DEFAULT_MODELS.anthropic, provider: 'anthropic' });

    } else {
        if (!key.startsWith('sk-')) return res.json({ ok: false, message: 'Key should start with sk-\u2026' });

        try {
            const check = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${key}` },
            });
            if (check.status === 401) return res.json({ ok: false, message: 'Invalid API key.' });
            if (!check.ok) return res.json({ ok: false, message: `OpenAI error (${check.status}).` });
        } catch {
            return res.json({ ok: false, message: 'Network error — could not reach OpenAI.' });
        }

        apiKeys.openai = key;
        res.json({ ok: true, model: DEFAULT_MODELS.openai, provider: 'openai' });
    }
});

// Remove an API key from server memory
app.delete('/api/key', (req, res) => {
    const provider = req.query.provider;
    if (provider && ['anthropic', 'openai'].includes(provider)) {
        apiKeys[provider] = null;
    } else {
        apiKeys.anthropic = null;
        apiKeys.openai = null;
    }
    res.json({ ok: true });
});

// Proxy chat requests to the appropriate provider
app.post('/api/chat', async (req, res) => {
    const { systemPrompt, messages, model } = req.body;

    // --- Request validation ---
    const provider = MODEL_PROVIDER[model || ''];
    if (!provider) {
        return res.status(400).json({ error: `Model not allowed: ${model}` });
    }

    const key = apiKeys[provider];
    if (!key) {
        return res.status(401).json({ error: `No API key configured for ${provider}.` });
    }

    if (typeof systemPrompt !== 'string' || systemPrompt.length > 8000) {
        return res.status(400).json({ error: 'Invalid or oversized systemPrompt (max 8000 chars).' });
    }
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
        return res.status(400).json({ error: 'messages must be an array of 1\u201350 items.' });
    }
    for (const msg of messages) {
        if (typeof msg.role !== 'string' || !['user', 'assistant'].includes(msg.role)) {
            return res.status(400).json({ error: 'Each message must have role "user" or "assistant".' });
        }
        if (typeof msg.content !== 'string' || msg.content.length === 0 || msg.content.length > 16000) {
            return res.status(400).json({ error: 'Each message.content must be a non-empty string (max 16000 chars).' });
        }
    }

    const callFn = provider === 'anthropic' ? callAnthropic : callOpenAI;

    try {
        const result = await callFn({ apiKey: key, model, systemPrompt, messages, maxTokens: MAX_TOKENS });

        tokenUsage.input += result.usage.input;
        tokenUsage.output += result.usage.output;

        // Normalize to the existing response shape so the browser needs no changes
        res.json({
            content: [{ type: 'text', text: result.text }],
            usage: { input_tokens: result.usage.input, output_tokens: result.usage.output },
            model: result.model,
            stop_reason: result.stopReason,
        });
    } catch (err) {
        if (err.status === 401) {
            return res.status(401).json({ error: err.message });
        }
        if (err.status) {
            return res.status(err.status).json({ error: err.message });
        }
        return res.status(502).json({ error: `Network error — could not reach ${provider}.` });
    }
});

// Cumulative token usage across refreshes
app.get('/api/usage', (req, res) => {
    res.json(tokenUsage);
});

// Static files (after API routes so /api/* isn't caught by static)
app.use(express.static(__dirname));

app.listen(PORT, '127.0.0.1', () => {
    const parts = [];
    if (apiKeys.anthropic) parts.push('Anthropic key loaded');
    if (apiKeys.openai) parts.push('OpenAI key loaded');
    const keyStatus = parts.length ? parts.join(', ') : 'No API keys — set via UI or .env';
    console.log(`Philosopher running at http://127.0.0.1:${PORT} (${keyStatus})`);
});

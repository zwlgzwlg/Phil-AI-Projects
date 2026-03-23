import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ALLOWED_MODELS = new Set([
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6',
    'claude-opus-4-6',
]);
const MAX_TOKENS = 512;

// API key lives here in server memory — never sent to the browser.
let apiKey = process.env.ANTHROPIC_API_KEY || null;

// Cumulative token usage — persists across page refreshes (resets on server restart)
const tokenUsage = { input: 0, output: 0 };

// Session token — generated at startup, required on all /api/* requests.
// This is a speed bump, not a hard boundary: any local process can fetch /api/token
// and replay it. The real security boundary is the loopback bind (127.0.0.1) which
// prevents network exposure. See SECURITY.md for the full trust model.
const SESSION_TOKEN = crypto.randomBytes(32).toString('hex');

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

// Check whether a key is configured (never reveals the key itself)
app.get('/api/status', (req, res) => {
    if (apiKey) {
        res.json({ ok: true, model: 'claude-haiku-4-5-20251001' });
    } else {
        res.json({ ok: false, message: 'No API key configured — click ⚙ to add one.' });
    }
});

// Set or update the API key (validated against Anthropic before accepting)
app.post('/api/key', async (req, res) => {
    const key = (req.body.key || '').trim();
    if (!key) return res.json({ ok: false, message: 'No key provided.' });
    if (!key.startsWith('sk-ant-')) return res.json({ ok: false, message: 'Key should start with sk-ant-…' });

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

    apiKey = key;
    res.json({ ok: true, model: 'claude-haiku-4-5-20251001' });
});

// Remove the API key from server memory
app.delete('/api/key', (req, res) => {
    apiKey = null;
    res.json({ ok: true });
});

// Proxy chat requests to Anthropic
app.post('/api/chat', async (req, res) => {
    if (!apiKey) return res.status(401).json({ error: 'No API key configured.' });

    const { systemPrompt, messages, model } = req.body;

    // --- Request validation ---
    if (!ALLOWED_MODELS.has(model || '')) {
        return res.status(400).json({ error: `Model not allowed: ${model}` });
    }
    if (typeof systemPrompt !== 'string' || systemPrompt.length > 8000) {
        return res.status(400).json({ error: 'Invalid or oversized systemPrompt (max 8000 chars).' });
    }
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
        return res.status(400).json({ error: 'messages must be an array of 1–50 items.' });
    }
    for (const msg of messages) {
        if (typeof msg.role !== 'string' || !['user', 'assistant'].includes(msg.role)) {
            return res.status(400).json({ error: 'Each message must have role "user" or "assistant".' });
        }
        if (typeof msg.content !== 'string' || msg.content.length === 0 || msg.content.length > 16000) {
            return res.status(400).json({ error: 'Each message.content must be a non-empty string (max 16000 chars).' });
        }
    }

    let apiRes;
    try {
        apiRes = await fetch(ANTHROPIC_API, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': ANTHROPIC_VERSION,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model,
                max_tokens: MAX_TOKENS,
                system: systemPrompt,
                messages,
            }),
        });
    } catch {
        return res.status(502).json({ error: 'Network error — could not reach Anthropic.' });
    }

    const data = await apiRes.json().catch(() => null);
    if (!data) return res.status(502).json({ error: 'Invalid response from Anthropic API.' });

    // Forward Anthropic errors with useful messages
    if (apiRes.status === 401) {
        apiKey = null; // Key is no longer valid
        return res.status(401).json({ error: 'API key rejected by Anthropic — please set a new one.' });
    }
    if (!apiRes.ok) {
        return res.status(apiRes.status).json({
            error: data.error?.message || `Anthropic API error (HTTP ${apiRes.status}).`,
        });
    }

    // Track token usage
    if (data.usage) {
        tokenUsage.input += data.usage.input_tokens || 0;
        tokenUsage.output += data.usage.output_tokens || 0;
    }

    res.json(data);
});

// Cumulative token usage across refreshes
app.get('/api/usage', (req, res) => {
    res.json(tokenUsage);
});

// Static files (after API routes so /api/* isn't caught by static)
app.use(express.static(__dirname));

app.listen(PORT, '127.0.0.1', () => {
    const keyStatus = apiKey ? 'API key loaded from .env' : 'No API key — set via UI or .env';
    console.log(`Philosopher running at http://127.0.0.1:${PORT} (${keyStatus})`);
});

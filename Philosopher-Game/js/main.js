import Game from './Game.js';
import LLMClient from './LLMClient.js';

const splashStatus = document.getElementById('splash-status');
const hudStatus = document.getElementById('llm-status');
const modelSelect = document.getElementById('model-select');

// Models available per provider
const PROVIDER_MODELS = {
    anthropic: [
        { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
        { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
        { id: 'claude-opus-4-6', label: 'Opus 4.6' },
    ],
    openai: [
        { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano' },
        { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
    ],
};

// Provider-specific info for the key modal
const PROVIDER_INFO = {
    anthropic: {
        desc: 'NPCs are powered by Claude. Your key is sent to the local game server '
            + 'and stored in memory \u2014 it is <strong>never</strong> exposed to the browser or sent anywhere '
            + 'except <strong>api.anthropic.com</strong>.<br><br>'
            + 'You can also set <code>ANTHROPIC_API_KEY</code> in <code>.env</code> before starting the server.<br><br>'
            + '<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Get a key at console.anthropic.com \u2192</a>',
        placeholder: 'sk-ant-...',
    },
    openai: {
        desc: 'NPCs are powered by GPT. Your key is sent to the local game server '
            + 'and stored in memory \u2014 it is <strong>never</strong> exposed to the browser or sent anywhere '
            + 'except <strong>api.openai.com</strong>.<br><br>'
            + 'You can also set <code>OPENAI_API_KEY</code> in <code>.env</code> before starting the server.<br><br>'
            + '<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">Get a key at platform.openai.com \u2192</a>',
        placeholder: 'sk-...',
    },
};

function setStatus(result) {
    if (result.ok) {
        const label = `LLM: ${result.model}`;
        splashStatus.textContent = label;
        splashStatus.className = 'status-ok';
        hudStatus.textContent = label;
        hudStatus.className = 'llm-status-ok';
        populateModelSelect(result.providers || {});
    } else {
        const label = result.message;
        splashStatus.textContent = label;
        splashStatus.className = 'status-error';
        hudStatus.textContent = 'LLM offline';
        hudStatus.className = 'llm-status-error';
        populateModelSelect({});
    }
}

function populateModelSelect(providers) {
    modelSelect.innerHTML = '';
    for (const [provider, models] of Object.entries(PROVIDER_MODELS)) {
        if (!providers[provider]) continue;
        const group = document.createElement('optgroup');
        group.label = provider === 'anthropic' ? 'Anthropic' : 'OpenAI';
        for (const m of models) {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.label;
            group.appendChild(opt);
        }
        modelSelect.appendChild(group);
    }
    // Select the current model if it exists in the list
    if (modelSelect.querySelector(`option[value="${LLMClient.currentModel}"]`)) {
        modelSelect.value = LLMClient.currentModel;
    } else if (modelSelect.options.length > 0) {
        LLMClient.currentModel = modelSelect.value;
    }
}

modelSelect.addEventListener('change', () => {
    LLMClient.currentModel = modelSelect.value;
    hudStatus.textContent = `LLM: ${modelSelect.value}`;
});

// --- Key modal ---

function getSelectedProvider() {
    return document.querySelector('input[name="key-provider"]:checked')?.value || 'anthropic';
}

function updateModalForProvider(provider) {
    const info = PROVIDER_INFO[provider];
    document.getElementById('key-modal-desc').innerHTML = info.desc;
    document.getElementById('key-input').placeholder = info.placeholder;
}

function openKeyModal() {
    document.getElementById('key-input').value = '';
    const statusEl = document.getElementById('key-modal-status');
    statusEl.textContent = '';
    statusEl.className = '';
    updateModalForProvider(getSelectedProvider());
    document.getElementById('key-modal').classList.remove('hidden');
    document.getElementById('key-input').focus();
}

function closeKeyModal() {
    document.getElementById('key-modal').classList.add('hidden');
}

// Provider radio toggle
for (const radio of document.querySelectorAll('input[name="key-provider"]')) {
    radio.addEventListener('change', () => {
        updateModalForProvider(radio.value);
        document.getElementById('key-input').value = '';
        const statusEl = document.getElementById('key-modal-status');
        statusEl.textContent = '';
        statusEl.className = '';
    });
}

// Wire modal buttons
document.getElementById('key-save-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('key-modal-status');
    const saveBtn = document.getElementById('key-save-btn');
    const val = document.getElementById('key-input').value;
    const provider = getSelectedProvider();
    statusEl.textContent = 'Verifying\u2026';
    statusEl.className = '';
    saveBtn.disabled = true;
    const result = await LLMClient.setKey(val, provider);
    saveBtn.disabled = false;
    if (result.ok) {
        statusEl.textContent = `\u2713 Connected \u2014 ${result.model}`;
        statusEl.className = 'key-status-ok';
        // Refresh full status to update model selector
        const status = await LLMClient.getStatus();
        setStatus(status);
        if (result.model) {
            LLMClient.currentModel = result.model;
            modelSelect.value = result.model;
        }
        setTimeout(closeKeyModal, 1000);
    } else {
        statusEl.textContent = result.message;
        statusEl.className = 'key-status-error';
    }
});

document.getElementById('key-remove-btn').addEventListener('click', async () => {
    const provider = getSelectedProvider();
    await LLMClient.removeKey(provider);
    document.getElementById('key-input').value = '';
    const statusEl = document.getElementById('key-modal-status');
    statusEl.textContent = `${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} key removed.`;
    statusEl.className = 'key-status-error';
    // Refresh full status
    const status = await LLMClient.getStatus();
    setStatus(status);
});

document.getElementById('key-cancel-btn').addEventListener('click', closeKeyModal);

window.addEventListener('DOMContentLoaded', async () => {
    const splash = document.getElementById('splash');
    const btnPlay = document.getElementById('btn-play');
    const btnSetup = document.getElementById('btn-setup');

    const status = await LLMClient.getStatus();
    setStatus(status);

    // Show modal automatically if no key is configured
    if (!status.ok) openKeyModal();

    btnSetup.addEventListener('click', openKeyModal);

    const nameInput = document.getElementById('player-name-input');

    btnPlay.addEventListener('click', () => {
        // Sanitize: strip to plain alphanumeric + spaces, max 10 chars
        const raw = nameInput.value.trim();
        const sanitized = raw.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 10).trim();
        if (!sanitized) {
            nameInput.focus();
            nameInput.style.borderColor = '#cc5533';
            return;
        }
        splash.style.display = 'none';
        const canvas = document.getElementById('game-canvas');
        window.game = new Game(canvas, sanitized);
        window.game.ui.onOpenKeyModal = openKeyModal;
    });
});

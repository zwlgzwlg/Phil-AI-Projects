import Game from './Game.js';
import LLMClient from './LLMClient.js';

const splashStatus = document.getElementById('splash-status');
const hudStatus = document.getElementById('llm-status');

function setStatus(result) {
    if (result.ok) {
        const label = `LLM: ${result.model}`;
        splashStatus.textContent = label;
        splashStatus.className = 'status-ok';
        hudStatus.textContent = label;
        hudStatus.className = 'llm-status-ok';
    } else {
        const label = result.message;
        splashStatus.textContent = label;
        splashStatus.className = 'status-error';
        hudStatus.textContent = 'LLM offline';
        hudStatus.className = 'llm-status-error';
    }
}

function openKeyModal() {
    document.getElementById('key-input').value = LLMClient.getKey() ?? '';
    const statusEl = document.getElementById('key-modal-status');
    statusEl.textContent = '';
    statusEl.className = '';
    document.getElementById('key-modal').classList.remove('hidden');
    document.getElementById('key-input').focus();
}

function closeKeyModal() {
    document.getElementById('key-modal').classList.add('hidden');
}

// Wire modal buttons once — work both before and after game starts (same DOM elements)
document.getElementById('key-show-btn').addEventListener('click', () => {
    const input = document.getElementById('key-input');
    const btn = document.getElementById('key-show-btn');
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? 'Show' : 'Hide';
});

document.getElementById('key-save-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('key-modal-status');
    const saveBtn = document.getElementById('key-save-btn');
    const val = document.getElementById('key-input').value;
    statusEl.textContent = 'Verifying…';
    statusEl.className = '';
    saveBtn.disabled = true;
    const result = await LLMClient.setKey(val);
    saveBtn.disabled = false;
    if (result.ok) {
        statusEl.textContent = `✓ Connected — ${result.model}`;
        statusEl.className = 'key-status-ok';
        setStatus(result);
        setTimeout(closeKeyModal, 1000);
    } else {
        statusEl.textContent = result.message;
        statusEl.className = 'key-status-error';
    }
});

document.getElementById('key-remove-btn').addEventListener('click', () => {
    LLMClient.removeKey();
    document.getElementById('key-input').value = '';
    const statusEl = document.getElementById('key-modal-status');
    statusEl.textContent = 'Key removed.';
    statusEl.className = 'key-status-error';
    setStatus({ ok: false, message: 'No API key — click ⚙ to add one' });
});

document.getElementById('key-cancel-btn').addEventListener('click', closeKeyModal);

window.addEventListener('DOMContentLoaded', async () => {
    const splash = document.getElementById('splash');
    const btnPlay = document.getElementById('btn-play');
    const btnSetup = document.getElementById('btn-setup');

    setStatus(await LLMClient.getStatus());

    // Show modal automatically if no key is saved
    if (!LLMClient.getKey()) openKeyModal();

    btnSetup.addEventListener('click', openKeyModal);

    btnPlay.addEventListener('click', () => {
        splash.style.display = 'none';
        const canvas = document.getElementById('game-canvas');
        window.game = new Game(canvas);
        window.game.ui.onOpenKeyModal = openKeyModal;
    });
});

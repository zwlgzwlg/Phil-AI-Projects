export default class UI {
    constructor() {
        // HUD elements
        this.hudHp = document.getElementById('hud-hp');
        this.hudZone = document.getElementById('hud-zone');
        this.hudTurn = document.getElementById('hud-turn');
        this.hudMove = document.getElementById('hud-move');
        this.hudAction = document.getElementById('hud-action');

        // Action buttons
        this.btnAttack = document.getElementById('btn-attack');
        this.btnSpeak = document.getElementById('btn-speak');
        this.btnItem = document.getElementById('btn-item');
        this.btnInteract = document.getElementById('btn-interact');
        this.btnEndTurn = document.getElementById('btn-end-turn');

        // Speech input
        this.speechInput = document.getElementById('speech-input');
        this.speechSendBtn = document.getElementById('btn-speak');

        // Log panel
        this.logPanel = document.getElementById('log-panel');

        // Inventory panel
        this.inventoryOverlay = document.getElementById('inventory-overlay');
        this.inventoryGrid = document.getElementById('inventory-grid');
        this.inventoryCloseBtn = document.getElementById('inventory-close-btn');

        // State
        this.inventoryActive = false;

        // Callbacks
        this.onAction = null;     // (actionType) => void
        this.onEndTurn = null;    // () => void
        this.onSpeak = null;      // (text) => void

        this._bindEvents();
    }

    _bindEvents() {
        this.btnAttack.addEventListener('click', () => this.onAction?.('attack'));
        this.btnItem.addEventListener('click', () => this.onAction?.('use_item'));
        this.btnInteract.addEventListener('click', () => this.onAction?.('interact'));
        this.btnEndTurn.addEventListener('click', () => this.onEndTurn?.());

        // Speak: clicking the Speak button sends whatever is in the speech input
        this.btnSpeak.addEventListener('click', () => this._sendSpeech());

        // Enter in speech input also sends
        this.speechInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._sendSpeech();
            }
            e.stopPropagation();
        });
        this.speechInput.addEventListener('keyup', (e) => e.stopPropagation());

        this.inventoryCloseBtn.addEventListener('click', () => this.closeInventory());
    }

    _sendSpeech() {
        const text = this.speechInput.value.trim();
        if (!text) return;
        this.speechInput.value = '';
        this.onSpeak?.(text);
    }

    // --- HUD ---
    updateHud(hp, maxHp, zoneName, turn, movePoints, maxMove, actionPoints, maxAction) {
        this.hudHp.textContent = `${hp}/${maxHp}`;
        this.hudZone.textContent = zoneName;
        this.hudTurn.textContent = turn;
        this.hudMove.textContent = `${movePoints}/${maxMove}`;
        this.hudAction.textContent = `${actionPoints}/${maxAction}`;
    }

    setActionButtons(available) {
        this.btnAttack.disabled = !available.attack;
        this.btnSpeak.disabled = !available.speak;
        this.btnItem.disabled = !available.item;
        this.btnInteract.disabled = !available.interact;
    }

    setSpeakEnabled(enabled) {
        this.speechInput.disabled = !enabled;
        this.btnSpeak.disabled = !enabled;
    }

    setEndTurnEnabled(enabled) {
        this.btnEndTurn.disabled = !enabled;
    }

    disableAllActions() {
        this.btnAttack.disabled = true;
        this.btnSpeak.disabled = true;
        this.btnItem.disabled = true;
        this.btnInteract.disabled = true;
        this.btnEndTurn.disabled = true;
        this.speechInput.disabled = true;
    }

    // --- Log ---
    updateLog(lines) {
        this.logPanel.innerHTML = '';
        for (const line of lines) {
            const div = document.createElement('div');
            div.classList.add('log-line');

            // Style speech lines differently (format: [Turn N] Name: "text")
            if (/\] .+: "/.test(line)) {
                div.classList.add('log-speech');
            }

            div.textContent = line;
            this.logPanel.appendChild(div);
        }
        this.logPanel.scrollTop = this.logPanel.scrollHeight;
    }

    appendLog(line) {
        const div = document.createElement('div');
        div.classList.add('log-line');
        div.textContent = line;
        this.logPanel.appendChild(div);
        this.logPanel.scrollTop = this.logPanel.scrollHeight;
    }

    // --- Inventory ---
    openInventory(inventory) {
        this.inventoryActive = true;
        this.inventoryOverlay.classList.remove('hidden');
        this.inventoryGrid.innerHTML = '';

        if (inventory.length === 0) {
            const empty = document.createElement('div');
            empty.classList.add('inventory-empty');
            empty.textContent = 'Your inventory is empty.';
            this.inventoryGrid.appendChild(empty);
            return;
        }

        inventory.forEach(item => {
            const slot = document.createElement('div');
            slot.classList.add('inventory-slot');

            const name = document.createElement('div');
            name.classList.add('inventory-item-name');
            name.textContent = item.name;

            const desc = document.createElement('div');
            desc.classList.add('inventory-item-desc');
            desc.textContent = item.description;

            slot.appendChild(name);
            slot.appendChild(desc);
            this.inventoryGrid.appendChild(slot);
        });
    }

    closeInventory() {
        this.inventoryActive = false;
        this.inventoryOverlay.classList.add('hidden');
    }

    isInventoryActive() {
        return this.inventoryActive;
    }
}

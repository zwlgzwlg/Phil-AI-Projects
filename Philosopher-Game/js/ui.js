export default class UI {
    constructor() {
        // HUD
        this.hudHp = document.getElementById('hud-hp');
        this.hudZone = document.getElementById('hud-zone');
        this.hudTurn = document.getElementById('hud-turn');
        this.hudMove = document.getElementById('hud-move');
        this.hudAction = document.getElementById('hud-action');

        // Speech bar
        this.speechInput = document.getElementById('speech-input');
        this.btnSpeak = document.getElementById('btn-speak');
        this.btnEndTurn = document.getElementById('btn-end-turn');

        // Log
        this.logPanel = document.getElementById('log-panel');

        // Inventory (persistent pane)
        this.inventoryList = document.getElementById('inventory-list');

        // Context menu
        this.contextMenu = document.getElementById('context-menu');

        // Inspect panel
        this.inspectOverlay = document.getElementById('inspect-overlay');
        this.inspectTitle = document.getElementById('inspect-title');
        this.inspectBody = document.getElementById('inspect-body');
        this.inspectCloseBtn = document.getElementById('inspect-close-btn');

        // Callbacks
        this.onEndTurn = null;
        this.onSpeak = null;
        this.onContextAction = null;  // (actionType, col, row, extra) => void
        this.onUseItem = null;        // (itemIndex) => void

        this._bindEvents();
    }

    _bindEvents() {
        this.btnSpeak.addEventListener('click', () => this._sendSpeech());
        this.btnEndTurn.addEventListener('click', () => this.onEndTurn?.());

        this.speechInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._sendSpeech();
            }
            e.stopPropagation();
        });
        this.speechInput.addEventListener('keyup', (e) => e.stopPropagation());

        this.inspectCloseBtn.addEventListener('click', () => this.closeInspect());

        // Close context menu on any left click or escape
        document.addEventListener('click', () => this.closeContextMenu());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeContextMenu();
                this.closeInspect();
            }
        });
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

    setSpeakEnabled(enabled) {
        this.speechInput.disabled = !enabled;
        this.btnSpeak.disabled = !enabled;
    }

    setEndTurnEnabled(enabled) {
        this.btnEndTurn.disabled = !enabled;
    }

    disableAllActions() {
        this.btnSpeak.disabled = true;
        this.btnEndTurn.disabled = true;
        this.speechInput.disabled = true;
    }

    // --- Context menu ---

    // Show a context menu at screen position (x, y) with a list of options.
    // Each option: { label, action, disabled? }
    showContextMenu(x, y, options) {
        this.contextMenu.innerHTML = '';
        for (const opt of options) {
            const item = document.createElement('div');
            item.classList.add('ctx-item');
            if (opt.disabled) item.classList.add('ctx-disabled');
            item.textContent = opt.label;
            if (!opt.disabled) {
                item.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.closeContextMenu();
                    opt.action();
                });
            }
            this.contextMenu.appendChild(item);
        }

        // Position
        this.contextMenu.style.left = x + 'px';
        this.contextMenu.style.top = y + 'px';
        this.contextMenu.classList.remove('hidden');

        // Keep on screen
        requestAnimationFrame(() => {
            const rect = this.contextMenu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                this.contextMenu.style.left = (x - rect.width) + 'px';
            }
            if (rect.bottom > window.innerHeight) {
                this.contextMenu.style.top = (y - rect.height) + 'px';
            }
        });
    }

    closeContextMenu() {
        this.contextMenu.classList.add('hidden');
    }

    // --- Inspect panel ---

    showInspect(info) {
        this.inspectBody.innerHTML = '';
        this.inspectTitle.textContent = info.name || 'Inspect';

        const addRow = (label, value) => {
            if (value === undefined || value === null) return;
            const row = document.createElement('div');
            row.classList.add('inspect-row');
            row.innerHTML = `<span class="inspect-label">${label}:</span> <span class="inspect-value">${value}</span>`;
            this.inspectBody.appendChild(row);
        };

        if (info.description) addRow('Description', info.description);
        if (info.hp !== undefined) addRow('HP', info.hp);
        if (info.attitude) addRow('Attitude', info.attitude);
        if (info.alive !== undefined) addRow('Status', info.alive ? 'Alive' : 'Dead');
        if (info.damage !== undefined) addRow('Damage', info.damage);
        if (info.armor !== undefined) addRow('Armor', info.armor);
        if (info.actionEffect) addRow('Combat effect', JSON.stringify(info.actionEffect));
        if (info.dialogueEffect) addRow('Dialogue effect', JSON.stringify(info.dialogueEffect));
        if (info.inventory && info.inventory.length > 0) addRow('Carrying', info.inventory.join(', '));

        this.inspectOverlay.classList.remove('hidden');
    }

    closeInspect() {
        this.inspectOverlay.classList.add('hidden');
    }

    // --- Log ---
    updateLog(lines) {
        this.logPanel.innerHTML = '';
        for (const line of lines) {
            const div = document.createElement('div');
            div.classList.add('log-line');
            if (/\] .+: "/.test(line)) {
                div.classList.add('log-speech');
            }
            div.textContent = line;
            this.logPanel.appendChild(div);
        }
        this.logPanel.scrollTop = this.logPanel.scrollHeight;
    }

    // --- Inventory (persistent pane) ---
    updateInventory(inventory, onUseItem, onDropItem) {
        this.inventoryList.innerHTML = '';

        if (inventory.length === 0) {
            const empty = document.createElement('div');
            empty.classList.add('inventory-empty');
            empty.textContent = 'Empty';
            this.inventoryList.appendChild(empty);
            return;
        }

        inventory.forEach((item, index) => {
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

            // Right-click on inventory item
            slot.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showContextMenu(e.clientX, e.clientY, [
                    { label: `Inspect ${item.name}`, action: () => this.showInspect({
                        name: item.name,
                        description: item.description,
                        actionEffect: item.actionEffect,
                        dialogueEffect: item.dialogueEffect,
                    })},
                    { label: `Use ${item.name}`, action: () => onUseItem?.(index) },
                    { label: `Drop ${item.name}`, action: () => onDropItem?.(index) },
                    { label: 'Cancel', action: () => {} },
                ]);
            });

            this.inventoryList.appendChild(slot);
        });
    }

    isInventoryActive() {
        return false; // No overlay anymore
    }
}

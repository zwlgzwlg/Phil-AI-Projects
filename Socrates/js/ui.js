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
        this.btnTalk = document.getElementById('btn-talk');
        this.btnItem = document.getElementById('btn-item');
        this.btnInteract = document.getElementById('btn-interact');
        this.btnEndTurn = document.getElementById('btn-end-turn');

        // Log panel
        this.logPanel = document.getElementById('log-panel');

        // Dialogue panel
        this.dialogueOverlay = document.getElementById('dialogue-overlay');
        this.dialogueNpcName = document.getElementById('dialogue-npc-name');
        this.chatLog = document.getElementById('chat-log');
        this.chatInput = document.getElementById('chat-input');
        this.chatSendBtn = document.getElementById('chat-send-btn');
        this.dialogueCloseBtn = document.getElementById('dialogue-close-btn');

        // Inventory panel
        this.inventoryOverlay = document.getElementById('inventory-overlay');
        this.inventoryGrid = document.getElementById('inventory-grid');
        this.inventoryCloseBtn = document.getElementById('inventory-close-btn');

        // State
        this.dialogueActive = false;
        this.inventoryActive = false;

        // Callbacks (set by Game)
        this.onAction = null;     // (actionType) => void
        this.onEndTurn = null;    // () => void
        this.onDialogueSend = null;
        this.onDialogueClose = null;

        this._bindEvents();
    }

    _bindEvents() {
        this.btnAttack.addEventListener('click', () => this.onAction?.('attack'));
        this.btnTalk.addEventListener('click', () => this.onAction?.('talk'));
        this.btnItem.addEventListener('click', () => this.onAction?.('use_item'));
        this.btnInteract.addEventListener('click', () => this.onAction?.('interact'));
        this.btnEndTurn.addEventListener('click', () => this.onEndTurn?.());

        this.chatSendBtn.addEventListener('click', () => this._sendChat());
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._sendChat();
            e.stopPropagation();
        });
        this.chatInput.addEventListener('keyup', (e) => e.stopPropagation());

        this.dialogueCloseBtn.addEventListener('click', () => {
            this.closeDialogue();
            this.onDialogueClose?.();
        });

        this.inventoryCloseBtn.addEventListener('click', () => this.closeInventory());
    }

    _sendChat() {
        const text = this.chatInput.value.trim();
        if (!text) return;
        this.chatInput.value = '';
        this.onDialogueSend?.(text);
    }

    // --- HUD ---
    updateHud(hp, maxHp, zoneName, turn, movePoints, maxMove, actionPoints, maxAction) {
        this.hudHp.textContent = `${hp}/${maxHp}`;
        this.hudZone.textContent = zoneName;
        this.hudTurn.textContent = turn;
        this.hudMove.textContent = `${movePoints}/${maxMove}`;
        this.hudAction.textContent = `${actionPoints}/${maxAction}`;
    }

    // Enable/disable action buttons
    setActionButtons(available) {
        this.btnAttack.disabled = !available.attack;
        this.btnTalk.disabled = !available.talk;
        this.btnItem.disabled = !available.item;
        this.btnInteract.disabled = !available.interact;
    }

    disableAllActions() {
        this.btnAttack.disabled = true;
        this.btnTalk.disabled = true;
        this.btnItem.disabled = true;
        this.btnInteract.disabled = true;
        this.btnEndTurn.disabled = true;
    }

    // --- Log ---
    updateLog(lines) {
        this.logPanel.innerHTML = '';
        for (const line of lines) {
            const div = document.createElement('div');
            div.classList.add('log-line');
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

    // --- Dialogue ---
    openDialogue(npcName, openingLine) {
        this.dialogueActive = true;
        this.dialogueNpcName.textContent = npcName;
        this.chatLog.innerHTML = '';
        this.dialogueOverlay.classList.remove('hidden');
        this.addChatMessage(npcName, openingLine);
        this.chatInput.focus();
    }

    closeDialogue() {
        this.dialogueActive = false;
        this.dialogueOverlay.classList.add('hidden');
    }

    addChatMessage(speaker, text) {
        const msg = document.createElement('div');
        msg.classList.add('chat-message', speaker === 'Socrates' ? 'chat-player' : 'chat-npc');

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('chat-speaker');
        nameSpan.textContent = speaker + ': ';

        const textSpan = document.createElement('span');
        textSpan.textContent = text;

        msg.appendChild(nameSpan);
        msg.appendChild(textSpan);
        this.chatLog.appendChild(msg);
        this.chatLog.scrollTop = this.chatLog.scrollHeight;
    }

    isDialogueActive() {
        return this.dialogueActive;
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

export default class UI {
    static _SLOT_LABELS = { head: 'Headwear', body: 'Bodywear', feet: 'Footwear', hands: 'Handheld' };

    constructor() {
        // HUD
        this.hudHp = document.getElementById('hud-hp');
        this.hudZone = document.getElementById('hud-zone');
        this.hudTurn = document.getElementById('hud-turn');
        this.hudMove = document.getElementById('hud-move');
        this.hudAction = document.getElementById('hud-action');
        this.hudTokensIn = document.getElementById('hud-tokens-in');
        this.hudTokensOut = document.getElementById('hud-tokens-out');
        this.hudCost = document.getElementById('hud-cost');

        // Speech bar
        this.speechInput = document.getElementById('speech-input');
        this.btnSpeak = document.getElementById('btn-speak');
        this.btnEndTurn = document.getElementById('btn-end-turn');

        // Log
        this.logPanel = document.getElementById('log-panel');

        // Inventory pane
        this.inventoryList = document.getElementById('inventory-list');

        // Equipment pane
        this.equipmentList = document.getElementById('equipment-list');

        // Hover info pane
        this.infoPanel = document.getElementById('info-panel');

        // Context menu
        this.contextMenu = document.getElementById('context-menu');

        // Debug panel
        this.debugSide = document.getElementById('debug-side');
        this.debugTabs = document.getElementById('debug-tabs');
        this.debugBody = document.getElementById('debug-body');
        this.debugCloseBtn = document.getElementById('debug-close-btn');
        this.btnDebug = document.getElementById('btn-debug');

        // Settings button
        this.btnSettings = document.getElementById('btn-settings');

        // Callbacks
        this.onEndTurn = null;
        this.onSpeak = null;
        this.onToggleDebug = null;
        this.onOpenKeyModal = null;

        this._bindEvents();
        this.clearInfoPane();
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

        this.btnDebug.addEventListener('click', () => this.onToggleDebug?.());
        this.debugCloseBtn.addEventListener('click', () => this.onToggleDebug?.());
        this.btnSettings.addEventListener('click', () => this.onOpenKeyModal?.());

        // Close context menu on any left click or escape
        document.addEventListener('click', () => this.closeContextMenu());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeContextMenu();
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

    // Per-model pricing in $/MTok
    static _PRICING = {
        'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
        'claude-sonnet-4-6':         { input: 3.00, output: 15.00 },
        'claude-opus-4-6':           { input: 15.00, output: 75.00 },
        'gpt-5.4-nano':              { input: 0.10, output: 0.40 },
        'gpt-5.4-mini':              { input: 0.40, output: 1.60 },
    };

    updateTokenUsage(usage, model) {
        this.hudTokensIn.textContent = usage.input.toLocaleString();
        this.hudTokensOut.textContent = usage.output.toLocaleString();
        const p = UI._PRICING[model] || UI._PRICING['claude-haiku-4-5-20251001'];
        const cost = (usage.input * p.input + usage.output * p.output) / 1_000_000;
        this.hudCost.textContent = `$${cost.toFixed(4)}`;
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

        this.contextMenu.style.left = x + 'px';
        this.contextMenu.style.top = y + 'px';
        this.contextMenu.classList.remove('hidden');

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

    // --- Hover info pane ---

    // Renders info for whatever is currently hovered (entity, item, or player).
    // info: { name, description?, hp?, alive?, damage?, armor?,
    //         visibleEquipment?, equipment?, equipSlot?, actionEffect?,
    //         dialogueEffect?, inventory?, worldItem? }
    updateInfoPane(info) {
        const p = this.infoPanel;
        p.innerHTML = '';
        if (!info) { this.clearInfoPane(); return; }

        // Title row: name + HP inline
        const titleRow = document.createElement('div');
        titleRow.classList.add('info-title-row');

        const titleEl = document.createElement('span');
        titleEl.classList.add('info-title');
        titleEl.textContent = info.name || '?';
        titleRow.appendChild(titleEl);

        if (info.hp !== undefined) {
            const hpEl = document.createElement('span');
            hpEl.classList.add('info-hp');
            if (info.alive === false) hpEl.classList.add('info-dead');
            hpEl.textContent = `HP ${info.hp}`;
            titleRow.appendChild(hpEl);
        }
        p.appendChild(titleRow);

        // Slot / type badge
        if (info.equipSlot) {
            const badge = document.createElement('div');
            badge.classList.add('info-badge');
            badge.textContent = UI._SLOT_LABELS[info.equipSlot] || info.equipSlot;
            if (info.worldItem) badge.classList.add('info-badge-world');
            p.appendChild(badge);
        }

        // Description
        if (info.description) {
            const desc = document.createElement('div');
            desc.classList.add('info-description');
            desc.textContent = info.description;
            p.appendChild(desc);
        }

        // Equipment slots — each on its own line
        // visibleEquipment: used for world hover (NPC/other entity) — already resolved to display strings
        // equipment: used for player self-hover — raw item objects
        const SLOT_ROWS = [
            { key: 'head',  label: 'Head'  },
            { key: 'body',  label: 'Body'  },
            { key: 'feet',  label: 'Feet'  },
            { key: 'hands', label: 'Hands' },
        ];

        if (info.visibleEquipment) {
            const eq = info.visibleEquipment;
            for (const { key, label } of SLOT_ROWS) {
                const isEmpty = !eq[key] || eq[key].startsWith('bare') || eq[key] === 'empty handed';
                p.appendChild(this._eqRow(label, eq[key], isEmpty));
            }
        }

        if (info.equipment) {
            const eq = info.equipment;
            const EMPTY = { head: 'bare head', body: 'bare body', feet: 'bare feet', hands: 'empty handed' };
            for (const { key, label } of SLOT_ROWS) {
                const item = eq[key];
                const text = item ? item.name : EMPTY[key];
                p.appendChild(this._eqRow(label, text, !item));
            }
        }

        // Stats — only shown for items in inventory/equipment (not world hover)
        if (!info.worldItem) {
            const stats = [];
            if (info.damage !== undefined)               stats.push(`Damage: ${info.damage}`);
            if (info.armor  !== undefined)               stats.push(`Armor: ${info.armor}`);
            if (info.actionEffect?.damage)               stats.push(`+${info.actionEffect.damage} dmg`);
            if (info.actionEffect?.armor)                stats.push(`+${info.actionEffect.armor} armor`);
            if (info.dialogueEffect?.trust)              stats.push(`+${info.dialogueEffect.trust} trust`);
            if (info.dialogueEffect?.resurrect)          stats.push('can resurrect');

            if (stats.length) {
                const statEl = document.createElement('div');
                statEl.classList.add('info-stats');
                statEl.textContent = stats.join('  ·  ');
                p.appendChild(statEl);
            }
        } else if (info.equipSlot) {
            const hint = document.createElement('div');
            hint.classList.add('info-hint');
            hint.textContent = 'Pick it up to learn more.';
            p.appendChild(hint);
        }

        if (info.inventory && info.inventory.length > 0) {
            const inv = document.createElement('div');
            inv.classList.add('info-carrying');
            inv.textContent = 'Carrying: ' + info.inventory.join(', ');
            p.appendChild(inv);
        }
    }

    clearInfoPane() {
        this.infoPanel.innerHTML = '<div class="info-empty">Hover to inspect.</div>';
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

    // --- Inventory pane ---
    updateInventory(inventory, onUseItem, onDropItem, onEquipItem) {
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

            slot.appendChild(name);

            // Hover → show full info in info pane
            slot.addEventListener('mouseenter', () => {
                this.updateInfoPane({
                    name: item.name,
                    description: item.description,
                    equipSlot: item.equipSlot || null,
                    actionEffect: item.actionEffect,
                    dialogueEffect: item.dialogueEffect,
                });
            });
            slot.addEventListener('mouseleave', () => this.clearInfoPane());

            // Right-click → action menu
            slot.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const options = [];
                if (item.equipSlot) {
                    options.push({ label: `Equip ${item.name}`, action: () => onEquipItem?.(index) });
                }
                options.push({ label: `Use ${item.name}`, action: () => onUseItem?.(index) });
                options.push({ label: `Drop ${item.name}`, action: () => onDropItem?.(index) });
                options.push({ label: 'Cancel', action: () => {} });
                this.showContextMenu(e.clientX, e.clientY, options);
            });

            this.inventoryList.appendChild(slot);
        });
    }

    // --- Equipment pane ---
    updateEquipment(equipment, onUnequip) {
        this.equipmentList.innerHTML = '';
        const SLOTS = [
            { key: 'head',  label: 'Head' },
            { key: 'body',  label: 'Body' },
            { key: 'feet',  label: 'Feet' },
            { key: 'hands', label: 'Hands' },
        ];

        for (const { key, label } of SLOTS) {
            const item = equipment[key];
            const row = document.createElement('div');
            row.classList.add('equip-slot');
            if (item) row.classList.add('equip-filled');

            const labelEl = document.createElement('span');
            labelEl.classList.add('equip-slot-label');
            labelEl.textContent = label;

            const itemEl = document.createElement('span');
            itemEl.classList.add('equip-slot-item');
            if (item) {
                itemEl.textContent = item.name;
            } else {
                itemEl.classList.add('equip-empty');
                itemEl.textContent = '—';
            }

            row.appendChild(labelEl);
            row.appendChild(itemEl);

            if (item) {
                // Hover → full info
                row.addEventListener('mouseenter', () => {
                    this.updateInfoPane({
                        name: item.name,
                        description: item.description,
                        equipSlot: item.equipSlot || key,
                        actionEffect: item.actionEffect,
                        dialogueEffect: item.dialogueEffect,
                    });
                });
                row.addEventListener('mouseleave', () => this.clearInfoPane());

                // Right-click → unequip
                row.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showContextMenu(e.clientX, e.clientY, [
                        { label: `Unequip ${item.name}`, action: () => onUnequip?.(key) },
                        { label: 'Cancel', action: () => {} },
                    ]);
                });
            }

            this.equipmentList.appendChild(row);
        }
    }

    // --- Debug panel ---

    showDebugPanel(conversations) {
        this.debugSide.classList.remove('hidden');
        this.btnDebug.classList.add('debug-active');

        const npcIds = Object.keys(conversations);
        if (npcIds.length === 0) {
            this.debugBody.innerHTML = '<div class="debug-empty">No NPC conversations yet.</div>';
            return;
        }

        if (!this._debugSelectedNpc || !conversations[this._debugSelectedNpc]) {
            this._debugSelectedNpc = npcIds[0];
        }

        this.debugTabs.innerHTML = '';
        for (const id of npcIds) {
            const tab = document.createElement('button');
            tab.classList.add('debug-tab');
            if (id === this._debugSelectedNpc) tab.classList.add('debug-tab-active');
            tab.textContent = conversations[id].npcName;
            tab.addEventListener('click', () => {
                this._debugSelectedNpc = id;
                this.showDebugPanel(conversations);
            });
            this.debugTabs.appendChild(tab);
        }

        const conv = conversations[this._debugSelectedNpc];
        this.debugBody.innerHTML = '';

        const sysSection = this._debugSection('System Prompt', conv.systemPrompt, 'debug-system');
        this.debugBody.appendChild(sysSection);

        for (const t of conv.turns) {
            const turnSection = document.createElement('div');
            turnSection.classList.add('debug-turn');

            const turnHeader = document.createElement('div');
            turnHeader.classList.add('debug-turn-header');
            turnHeader.textContent = `Turn ${t.turn}` + (t.error ? ' [ERROR]' : '');
            turnSection.appendChild(turnHeader);

            turnSection.appendChild(this._debugSection('Prompt sent', t.turnPrompt, 'debug-prompt'));

            if (t.rawResponse) {
                turnSection.appendChild(this._debugSection('Raw response', t.rawResponse, 'debug-response'));
            }
            if (t.parsedDecision) {
                turnSection.appendChild(this._debugSection('Parsed decision', JSON.stringify(t.parsedDecision, null, 2), 'debug-parsed'));
            }
            if (t.error) {
                turnSection.appendChild(this._debugSection('Error', t.error, 'debug-error'));
            }

            this.debugBody.appendChild(turnSection);
        }

        this.debugBody.scrollTop = this.debugBody.scrollHeight;
    }

    hideDebugPanel() {
        this.debugSide.classList.add('hidden');
        this.btnDebug.classList.remove('debug-active');
    }

    _eqRow(label, value, isEmpty) {
        const row = document.createElement('div');
        row.classList.add('info-eq-row');
        const labelEl = document.createElement('span');
        labelEl.classList.add('info-eq-label');
        labelEl.textContent = label;
        const itemEl = document.createElement('span');
        itemEl.classList.add('info-eq-item');
        if (isEmpty) itemEl.classList.add('info-eq-empty');
        itemEl.textContent = value;
        row.appendChild(labelEl);
        row.appendChild(itemEl);
        return row;
    }

    _debugSection(title, content, className) {
        const section = document.createElement('details');
        section.classList.add('debug-section', className || '');
        const summary = document.createElement('summary');
        summary.textContent = title;
        section.appendChild(summary);
        const pre = document.createElement('pre');
        pre.textContent = content;
        section.appendChild(pre);
        return section;
    }
}

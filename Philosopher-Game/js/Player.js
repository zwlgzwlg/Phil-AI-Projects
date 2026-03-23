export default class Player {
    constructor(col, row) {
        this.col = col;
        this.row = row;
        this.hp = 45;
        this.maxHp = 45;
        this.inventory = [];
        this.equipment = { head: null, body: null, feet: null, hands: null };
        this.baseDamage = 10;
        this.symbol = '@';
        this.color = '#ffffff';
        this.name = 'Player'; // Set during character creation
        this.description = 'A wandering philosopher.';
    }

    moveTo(col, row) {
        this.col = col;
        this.row = row;
    }

    getDamage() {
        let dmg = this.baseDamage;
        for (const item of Object.values(this.equipment)) {
            if (item?.actionEffect?.damage) dmg += item.actionEffect.damage;
        }
        return dmg;
    }

    getArmor() {
        let armor = 0;
        for (const item of Object.values(this.equipment)) {
            if (item?.actionEffect?.armor) armor += item.actionEffect.armor;
        }
        return armor;
    }

    takeDamage(amount) {
        const reduced = Math.max(1, amount - this.getArmor());
        this.hp = Math.max(0, this.hp - reduced);
        return reduced;
    }

    // Equip an item from inventory at the given index.
    // Returns the previously equipped item in that slot (or null) — caller adds it back to inventory.
    equipItem(item, inventoryIndex) {
        const slot = item.equipSlot;
        if (!slot || !(slot in this.equipment)) return null;
        const swapped = this.equipment[slot];
        this.equipment[slot] = item;
        this.inventory.splice(inventoryIndex, 1);
        return swapped;
    }

    // Unequip whatever is in the given slot, returning it to inventory.
    unequipItem(slot) {
        const item = this.equipment[slot];
        if (!item) return null;
        this.equipment[slot] = null;
        this.inventory.push(item);
        return item;
    }

    addItem(item) {
        this.inventory.push(item);
    }

    removeItem(index) {
        return this.inventory.splice(index, 1)[0];
    }

    // Visible public info — what an observer sees at a glance
    getPublicInfo() {
        const EMPTY_LABELS = { head: 'bare head', body: 'bare body', feet: 'bare feet', hands: 'empty handed' };
        const visibleEquipment = {};
        for (const slot of ['head', 'body', 'feet', 'hands']) {
            const item = this.equipment[slot];
            visibleEquipment[slot] = item ? (item.visibleName || item.name) : EMPTY_LABELS[slot];
        }
        return {
            name: this.name,
            description: this.description,
            hp: `${this.hp}/${this.maxHp}`,
            alive: this.isAlive(),
            visibleEquipment,
        };
    }

    hasItem(id) {
        return this.inventory.some(i => i.id === id);
    }

    isAlive() {
        return this.hp > 0;
    }
}

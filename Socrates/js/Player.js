export default class Player {
    constructor(col, row) {
        this.col = col;
        this.row = row;
        this.hp = 100;
        this.maxHp = 100;
        this.inventory = [];
        this.baseDamage = 10;
        this.symbol = '@';
        this.color = '#ffffff';
        this.name = 'Socrates';
    }

    moveTo(col, row) {
        this.col = col;
        this.row = row;
    }

    getDamage() {
        let dmg = this.baseDamage;
        for (const item of this.inventory) {
            if (item.actionEffect && item.actionEffect.damage) {
                dmg += item.actionEffect.damage;
            }
        }
        return dmg;
    }

    getArmor() {
        let armor = 0;
        for (const item of this.inventory) {
            if (item.actionEffect && item.actionEffect.armor) {
                armor += item.actionEffect.armor;
            }
        }
        return armor;
    }

    takeDamage(amount) {
        const reduced = Math.max(1, amount - this.getArmor());
        this.hp = Math.max(0, this.hp - reduced);
        return reduced;
    }

    addItem(item) {
        this.inventory.push(item);
    }

    hasItem(id) {
        return this.inventory.some(i => i.id === id);
    }

    isAlive() {
        return this.hp > 0;
    }
}

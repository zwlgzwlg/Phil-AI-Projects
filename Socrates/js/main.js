import Game from './Game.js';

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    window.game = new Game(canvas);
});

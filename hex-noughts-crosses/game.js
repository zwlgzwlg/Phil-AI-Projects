(() => {
  'use strict';

  // ===== Configuration =====
  const config = {
    boardSize: 11,
    get boardWidth() { return this.boardSize; },
    get boardHeight() { return this.boardSize; },
    hexSize: 28,
    winLength: 6,
  };

  const COLORS = {
    bg: '#16213e',
    hexFill: '#2a2a40',
    hexStroke: '#3d3d5c',
    hexHover: '#3a3a58',
    playerX: '#4A90D9',
    playerO: '#D94A4A',
    playerXLight: 'rgba(74, 144, 217, 0.25)',
    playerOLight: 'rgba(217, 74, 74, 0.25)',
    winGlow: '#FFD700',
    pieceText: '#ffffff',
    pendingRing: '#FFD700',
  };

  const SQRT3 = Math.sqrt(3);

  // ===== State =====
  let board = new Map();        // "q,r" -> 'X' | 'O'
  let moves = [];               // [{q, r}, ...]
  let gameOver = false;
  let winner = null;
  let winningCells = [];
  let hoveredCell = null;       // {q, r} or null

  // ===== AI State =====
  let aiEnabled = false;
  let aiPlayer = 'O';
  let aiThinking = false;
  let policyHeatmap = null;     // Map of "q,r" -> probability
  let currentEval = null;       // number in [-1, 1], from X's perspective
  let showHeatmap = true;
  const AI_SERVER = 'http://localhost:5000';

  // ===== DOM refs =====
  let canvas, ctx;

  // ===== Hex Math =====
  function key(q, r) { return `${q},${r}`; }

  function axialToPixel(q, r) {
    return {
      x: config.hexSize * (SQRT3 * q + SQRT3 / 2 * r),
      y: config.hexSize * (1.5 * r),
    };
  }

  function pixelToAxial(px, py) {
    const q = (SQRT3 / 3 * px - 1 / 3 * py) / config.hexSize;
    const r = (2 / 3 * py) / config.hexSize;
    return axialRound(q, r);
  }

  function axialRound(fq, fr) {
    const fs = -fq - fr;
    let rq = Math.round(fq);
    let rr = Math.round(fr);
    let rs = Math.round(fs);
    const dq = Math.abs(rq - fq);
    const dr = Math.abs(rr - fr);
    const ds = Math.abs(rs - fs);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    return { q: rq, r: rr };
  }

  function wrapCoord(q, r) {
    return {
      q: ((q % config.boardSize) + config.boardSize) % config.boardSize,
      r: ((r % config.boardSize) + config.boardSize) % config.boardSize,
    };
  }

  function isOnBoard(q, r) {
    return q >= 0 && q < config.boardWidth && r >= 0 && r < config.boardHeight;
  }

  // ===== Turn Logic =====
  // Move 0: X places 1. Then O places 2, X places 2, O places 2, ...
  function getTurnInfo(moveCount) {
    if (moveCount === 0) return { player: 'X', piecesLeft: 1, turnNumber: 1 };
    const adj = moveCount - 1;
    const turnIndex = Math.floor(adj / 2);
    const player = turnIndex % 2 === 0 ? 'O' : 'X';
    const piecesLeft = 2 - (adj % 2);
    const turnNumber = turnIndex + 2;
    return { player, piecesLeft, turnNumber };
  }

  function currentTurnInfo() {
    return getTurnInfo(moves.length);
  }

  function currentTurnPendingMoves() {
    const info = currentTurnInfo();
    if (moves.length === 0) return [];
    const maxPieces = moves.length <= 1 ? 1 : 2;
    // How many have been placed in this "logical turn"?
    // We are at move index moves.length (next to place).
    // The current turn started at some earlier index.
    if (moves.length === 0) return [];
    if (moves.length === 1) return []; // turn 1 is complete (1 piece), or it's the only move
    // After move 0 (X's first): turn 1 done. Moves 1,2 = turn 2. Moves 3,4 = turn 3...
    // Current turn starts at: move 0 is solo. After that, pairs.
    // If moveCount=1, just finished turn 1. piecesLeft for turn 2 = 2. No pending.
    // If moveCount=2, in turn 2, placed 1 of 2. Pending = [moves[1]]
    // If moveCount=3, turn 2 done. piecesLeft for turn 3 = 2. No pending.
    // If moveCount=4, in turn 3, placed 1 of 2. Pending = [moves[3]]
    if (info.piecesLeft === 1 && maxPieces === 2) {
      // One piece placed in current turn, one more to go
      return [moves[moves.length - 1]];
    }
    return [];
  }

  // ===== Game Logic =====
  function placePiece(q, r) {
    if (gameOver) return false;
    const w = wrapCoord(q, r);
    q = w.q; r = w.r;
    if (!isOnBoard(q, r)) return false;
    if (board.has(key(q, r))) return false;

    const info = currentTurnInfo();
    board.set(key(q, r), info.player);
    moves.push({ q, r });

    if (checkWin(q, r, info.player)) {
      gameOver = true;
      winner = info.player;
    } else if (moves.length >= config.boardWidth * config.boardHeight) {
      gameOver = true;
      winner = null; // draw
    }

    return true;
  }

  function checkWin(q, r, player) {
    const directions = [
      { dq: 1, dr: 0 },
      { dq: 0, dr: 1 },
      { dq: 1, dr: -1 },
    ];

    for (const { dq, dr } of directions) {
      const cells = [{ q, r }];

      for (let i = 1; i < config.winLength; i++) {
        let nq = q + dq * i, nr = r + dr * i;
        const w1 = wrapCoord(nq, nr);
        nq = w1.q; nr = w1.r;
        if (nq === q && nr === r) break; // wrapped back to start
        if (board.get(key(nq, nr)) !== player) break;
        cells.push({ q: nq, r: nr });
      }

      for (let i = 1; i < config.winLength; i++) {
        let nq = q - dq * i, nr = r - dr * i;
        const w2 = wrapCoord(nq, nr);
        nq = w2.q; nr = w2.r;
        if (nq === q && nr === r) break;
        if (board.get(key(nq, nr)) !== player) break;
        cells.unshift({ q: nq, r: nr });
      }

      if (cells.length >= config.winLength) {
        winningCells = cells.slice(0, config.winLength);
        return true;
      }
    }
    return false;
  }

  function undo() {
    if (moves.length <= 1) return; // don't undo the auto-placed center X
    if (aiThinking) return;
    if (gameOver) {
      gameOver = false;
      winner = null;
      winningCells = [];
    }
    const last = moves.pop();
    board.delete(key(last.q, last.r));
    // In AI mode, keep undoing until it's the human's turn
    if (aiEnabled && moves.length > 1) {
      const info = currentTurnInfo();
      if (info.player === aiPlayer) {
        const prev = moves.pop();
        board.delete(key(prev.q, prev.r));
      }
    }
    policyHeatmap = null;
    currentEval = null;
    updateEvalBar();
    updateUI();
    render();
    if (aiEnabled && !gameOver) {
      requestEvaluation();
    }
  }

  function resetGame() {
    board.clear();
    moves = [];
    gameOver = false;
    winner = null;
    winningCells = [];
    hoveredCell = null;
    aiThinking = false;
    policyHeatmap = null;
    currentEval = null;
    document.getElementById('status').classList.remove('ai-thinking');
    updateEvalBar();
    // Auto-place X in the center
    const cq = Math.floor(config.boardSize / 2);
    const cr = Math.floor(config.boardSize / 2);
    board.set(key(cq, cr), 'X');
    moves.push({ q: cq, r: cr });
    resizeCanvas();
    updateUI();
    render();
    // If AI plays O (the default), AI goes first after X is auto-placed
    if (aiEnabled && aiPlayer === currentTurnInfo().player) {
      requestAiMove();
    }
  }

  // ===== Rendering =====
  function getCanvasOffset() {
    const padding = config.hexSize * 1.5;
    return { ox: padding, oy: padding };
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const { ox, oy } = getCanvasOffset();
    const lastCell = axialToPixel(config.boardWidth - 1, config.boardHeight - 1);
    const w = lastCell.x + ox * 2;
    const h = lastCell.y + oy * 2;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function render() {
    const { ox, oy } = getCanvasOffset();
    const w = parseFloat(canvas.style.width);
    const h = parseFloat(canvas.style.height);
    ctx.clearRect(0, 0, w, h);

    const info = currentTurnInfo();
    const pending = currentTurnPendingMoves();
    const pendingKeys = new Set(pending.map(m => key(m.q, m.r)));
    const winKeys = new Set(winningCells.map(c => key(c.q, c.r)));

    for (let r = 0; r < config.boardHeight; r++) {
      for (let q = 0; q < config.boardWidth; q++) {
        const { x, y } = axialToPixel(q, r);
        const px = x + ox;
        const py = y + oy;
        const k = key(q, r);
        const cellPlayer = board.get(k);
        const isHovered = hoveredCell && hoveredCell.q === q && hoveredCell.r === r;
        const isWinCell = winKeys.has(k);
        const isPending = pendingKeys.has(k);

        // Draw hex
        drawHexPath(px, py, config.hexSize);

        // Fill
        if (isWinCell) {
          ctx.fillStyle = COLORS.winGlow;
          ctx.globalAlpha = 0.35;
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (isHovered && !cellPlayer && !gameOver) {
          ctx.fillStyle = info.player === 'X' ? COLORS.playerXLight : COLORS.playerOLight;
          ctx.fill();
        } else {
          ctx.fillStyle = COLORS.hexFill;
          ctx.fill();
        }

        // Stroke
        ctx.strokeStyle = isWinCell ? COLORS.winGlow : COLORS.hexStroke;
        ctx.lineWidth = isWinCell ? 2.5 : 1;
        ctx.stroke();

        // Piece
        if (cellPlayer) {
          drawPiece(px, py, cellPlayer, config.hexSize * 0.55);
          // Pending ring
          if (isPending) {
            ctx.beginPath();
            ctx.arc(px, py, config.hexSize * 0.65, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.pendingRing;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // Policy heatmap overlay
        if (showHeatmap && policyHeatmap && !cellPlayer && !isWinCell) {
          const prob = policyHeatmap.get(k) || 0;
          if (prob > 0.005) {
            drawHexPath(px, py, config.hexSize);
            ctx.fillStyle = `rgba(0, 255, 128, ${Math.min(prob * 5, 0.6)})`;
            ctx.fill();
          }
        }

        // Hover ghost piece
        if (isHovered && !cellPlayer && !gameOver) {
          ctx.globalAlpha = 0.4;
          drawPiece(px, py, info.player, config.hexSize * 0.55);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  function drawHexPath(cx, cy, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 180 * (60 * i - 30);
      const hx = cx + size * Math.cos(angle);
      const hy = cy + size * Math.sin(angle);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
  }

  function drawPiece(cx, cy, player, radius) {
    if (player === 'X') {
      ctx.fillStyle = COLORS.playerX;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      // Draw X
      const s = radius * 0.55;
      ctx.strokeStyle = COLORS.pieceText;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - s, cy - s);
      ctx.lineTo(cx + s, cy + s);
      ctx.moveTo(cx + s, cy - s);
      ctx.lineTo(cx - s, cy + s);
      ctx.stroke();
    } else {
      ctx.fillStyle = COLORS.playerO;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      // Draw O
      ctx.strokeStyle = COLORS.pieceText;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ===== Input =====
  function getHexFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const { ox, oy } = getCanvasOffset();
    const mx = e.clientX - rect.left - ox;
    const my = e.clientY - rect.top - oy;
    const { q, r } = pixelToAxial(mx, my);
    const w = wrapCoord(q, r);
    if (isOnBoard(w.q, w.r)) return w;
    return null;
  }

  function handleClick(e) {
    if (aiThinking) return;
    const info = currentTurnInfo();
    if (aiEnabled && info.player === aiPlayer) return;
    const cell = getHexFromEvent(e);
    if (!cell) return;
    if (placePiece(cell.q, cell.r)) {
      updateUI();
      render();
      if (aiEnabled && !gameOver) {
        const nextInfo = currentTurnInfo();
        if (nextInfo.player === aiPlayer) {
          requestAiMove();
        } else {
          requestEvaluation();
        }
      }
    }
  }

  function handleMouseMove(e) {
    const cell = getHexFromEvent(e);
    const prev = hoveredCell;
    hoveredCell = cell;
    if (!prev && !cell) return;
    if (prev && cell && prev.q === cell.q && prev.r === cell.r) return;
    render();
  }

  function handleMouseLeave() {
    if (hoveredCell) {
      hoveredCell = null;
      render();
    }
  }

  // ===== AI =====
  function getMoveList() {
    return moves.map(m => [m.q, m.r]);
  }

  async function requestAiMove() {
    if (gameOver || aiThinking) return;
    aiThinking = true;
    document.getElementById('status').classList.add('ai-thinking');
    updateUI();

    try {
      const resp = await fetch(AI_SERVER + '/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moves: getMoveList(),
          board_size: config.boardSize,
          win_length: config.winLength,
          num_simulations: 400,
        }),
      });
      if (!resp.ok) throw new Error('Server error');
      const data = await resp.json();

      // Store evaluation data
      currentEval = data.value;
      if (data.policy) {
        policyHeatmap = new Map(Object.entries(data.policy));
      }
      updateEvalBar();

      // Place the AI's piece
      const [aq, ar] = data.action;
      placePiece(aq, ar);
      updateUI();
      render();

      // AI may need to place a second piece this turn
      if (!gameOver) {
        const nextInfo = currentTurnInfo();
        if (nextInfo.player === aiPlayer) {
          // Still AI's turn - request second piece
          aiThinking = false;
          await requestAiMove();
          return;
        }
      }
    } catch (err) {
      console.error('AI move failed:', err);
    }

    aiThinking = false;
    document.getElementById('status').classList.remove('ai-thinking');
    updateUI();
    render();

    if (!gameOver && aiEnabled) {
      requestEvaluation();
    }
  }

  async function requestEvaluation() {
    if (!aiEnabled || gameOver) {
      policyHeatmap = null;
      currentEval = null;
      updateEvalBar();
      render();
      return;
    }

    try {
      const resp = await fetch(AI_SERVER + '/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moves: getMoveList(),
          board_size: config.boardSize,
          win_length: config.winLength,
        }),
      });
      if (!resp.ok) throw new Error('Server error');
      const data = await resp.json();

      currentEval = data.value;
      if (data.policy) {
        policyHeatmap = new Map(Object.entries(data.policy));
      }
      updateEvalBar();
      render();
    } catch (err) {
      console.error('Evaluation failed:', err);
    }
  }

  function updateEvalBar() {
    const fillEl = document.getElementById('eval-fill');
    const labelEl = document.getElementById('eval-label');
    if (currentEval === null) {
      fillEl.style.width = '50%';
      labelEl.textContent = '';
      return;
    }
    // currentEval is from X's perspective: +1 = X winning, -1 = O winning
    const pct = ((currentEval + 1) / 2 * 100).toFixed(1);
    fillEl.style.width = pct + '%';
    const sign = currentEval >= 0 ? '+' : '';
    labelEl.textContent = `${sign}${currentEval.toFixed(2)} (X perspective)`;
  }

  // ===== UI Updates =====
  function updateUI() {
    const info = currentTurnInfo();

    const playerEl = document.getElementById('current-player');
    const piecesEl = document.getElementById('pieces-left');
    const pluralEl = document.getElementById('pieces-plural');
    const turnNumEl = document.getElementById('turn-number');
    const resultEl = document.getElementById('game-result');

    playerEl.textContent = info.player;
    playerEl.className = info.player === 'X' ? 'player-x' : 'player-o';
    piecesEl.textContent = info.piecesLeft;
    pluralEl.textContent = info.piecesLeft > 1 ? 's' : '';
    turnNumEl.textContent = `Turn ${info.turnNumber}`;

    if (gameOver) {
      resultEl.classList.remove('hidden', 'win-x', 'win-o', 'draw');
      if (winner) {
        resultEl.textContent = `${winner} wins!`;
        resultEl.classList.add(winner === 'X' ? 'win-x' : 'win-o');
      } else {
        resultEl.textContent = 'Draw!';
        resultEl.classList.add('draw');
      }
    } else {
      resultEl.classList.add('hidden');
    }

    // Update rules win length display
    document.querySelectorAll('.win-len').forEach(el => {
      el.textContent = config.winLength;
    });
  }

  // ===== Settings =====
  function bindSettings() {
    const sizeEl = document.getElementById('board-size');
    const winEl = document.getElementById('win-length');

    function applySettings() {
      config.boardSize = parseInt(sizeEl.value) || 11;
      config.winLength = parseInt(winEl.value) || 6;
      resetGame();
    }

    sizeEl.addEventListener('change', applySettings);
    winEl.addEventListener('change', applySettings);

    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-new-game').addEventListener('click', resetGame);

    // AI controls
    const aiToggle = document.getElementById('ai-toggle');
    const aiColorEl = document.getElementById('ai-color');
    const heatmapToggle = document.getElementById('heatmap-toggle');

    aiToggle.addEventListener('change', () => {
      aiEnabled = aiToggle.checked;
      policyHeatmap = null;
      currentEval = null;
      updateEvalBar();
      render();
      if (aiEnabled && !gameOver) {
        const info = currentTurnInfo();
        if (info.player === aiPlayer) {
          requestAiMove();
        } else {
          requestEvaluation();
        }
      }
    });

    aiColorEl.addEventListener('change', () => {
      aiPlayer = aiColorEl.value;
      if (aiEnabled) resetGame();
    });

    heatmapToggle.addEventListener('change', () => {
      showHeatmap = heatmapToggle.checked;
      render();
    });
  }

  // ===== Keyboard shortcuts =====
  function handleKeyDown(e) {
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      undo();
    }
    if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      resetGame();
    }
  }

  // ===== Init =====
  function init() {
    canvas = document.getElementById('board');
    ctx = canvas.getContext('2d');

    bindSettings();

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('keydown', handleKeyDown);

    resetGame(); // places X in center, sizes canvas, renders
  }

  document.addEventListener('DOMContentLoaded', init);
})();

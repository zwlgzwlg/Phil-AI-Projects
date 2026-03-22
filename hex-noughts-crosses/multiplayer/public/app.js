(() => {
  'use strict';

  const socket = io();

  // ===== Views =====
  const lobbyView = document.getElementById('lobby-view');
  const waitingView = document.getElementById('waiting-view');
  const gameView = document.getElementById('game-view');

  function showView(view) {
    lobbyView.classList.add('hidden');
    waitingView.classList.add('hidden');
    gameView.classList.add('hidden');
    view.classList.remove('hidden');
  }

  // ===== Configuration =====
  const config = {
    boardSize: 11,
    get boardWidth() { return this.boardSize; },
    get boardHeight() { return this.boardSize; },
    hexSize: 28,
    winLength: 6,
  };

  const COLORS = {
    boardBg: '#d4a85c',        // warm wood surround
    hexFill: '#dcc591',        // beige hex
    hexStroke: '#b8a070',      // darker beige border
    hoverBlack: 'rgba(0, 0, 0, 0.15)',
    hoverWhite: 'rgba(255, 255, 255, 0.3)',
    winGlow: '#c8102e',        // red highlight for winning line
    pendingRing: '#c8102e',
  };

  const SQRT3 = Math.sqrt(3);

  // ===== Game State =====
  let board = new Map();       // "q,r" -> 'B' | 'W'
  let moves = [];
  let gameOver = false;
  let winner = null;
  let winningCells = [];
  let hoveredCell = null;
  let mySide = null;           // 'B' or 'W'
  let currentGameId = null;
  let gameState = null;
  let canvas, ctx;

  // Timer display state
  let timerDisplayInterval = null;
  let localTimeB = null;
  let localTimeW = null;
  let localLastTick = null;

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
  // Move 0: Black places 1 (auto). Then White places 2, Black places 2, ...
  function getTurnInfo(moveCount) {
    if (moveCount === 0) return { player: 'B', piecesLeft: 1, turnNumber: 1 };
    const adj = moveCount - 1;
    const turnIndex = Math.floor(adj / 2);
    const player = turnIndex % 2 === 0 ? 'W' : 'B';
    const piecesLeft = 2 - (adj % 2);
    const turnNumber = turnIndex + 2;
    return { player, piecesLeft, turnNumber };
  }

  function currentTurnInfo() {
    return getTurnInfo(moves.length);
  }

  function currentTurnPendingMoves() {
    const info = currentTurnInfo();
    if (moves.length <= 1) return [];
    if (info.piecesLeft === 1 && moves.length > 1) {
      return [moves[moves.length - 1]];
    }
    return [];
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
    if (!canvas) return;
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

        drawHexPath(px, py, config.hexSize);

        // Fill hex
        if (isWinCell) {
          ctx.fillStyle = COLORS.winGlow;
          ctx.globalAlpha = 0.3;
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (isHovered && !cellPlayer && !gameOver && isMyTurn()) {
          ctx.fillStyle = COLORS.hexFill;
          ctx.fill();
          // Tinted hover overlay
          drawHexPath(px, py, config.hexSize);
          ctx.fillStyle = info.player === 'B' ? COLORS.hoverBlack : COLORS.hoverWhite;
          ctx.fill();
        } else {
          ctx.fillStyle = COLORS.hexFill;
          ctx.fill();
        }

        // Stroke
        ctx.strokeStyle = isWinCell ? COLORS.winGlow : COLORS.hexStroke;
        ctx.lineWidth = isWinCell ? 2.5 : 1;
        ctx.stroke();

        // Stone
        if (cellPlayer) {
          drawStone(px, py, cellPlayer, config.hexSize * 0.55);
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

        // Hover ghost stone
        if (isHovered && !cellPlayer && !gameOver && isMyTurn()) {
          ctx.globalAlpha = 0.4;
          drawStone(px, py, info.player, config.hexSize * 0.55);
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

  function drawStone(cx, cy, player, radius) {
    if (player === 'B') {
      // Black stone with subtle 3D shading
      const grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
      grad.addColorStop(0, '#555');
      grad.addColorStop(0.6, '#222');
      grad.addColorStop(1, '#000');
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      // Subtle edge
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    } else {
      // White stone with subtle 3D shading
      const grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.6, '#eee');
      grad.addColorStop(1, '#ccc');
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      // Edge shadow
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  // ===== Input =====
  function isMyTurn() {
    if (!mySide || gameOver) return false;
    const info = currentTurnInfo();
    return info.player === mySide;
  }

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
    if (!isMyTurn()) return;
    const cell = getHexFromEvent(e);
    if (!cell) return;
    if (board.has(key(cell.q, cell.r))) return;
    socket.emit('game:move', { q: cell.q, r: cell.r });
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

  // ===== Timer Display =====
  function formatTime(ms) {
    if (ms === null || ms === undefined) return '';
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  function startLocalTimer() {
    stopLocalTimer();
    localLastTick = Date.now();
    timerDisplayInterval = setInterval(() => {
      if (!gameState || gameOver || gameState.status !== 'playing') return;
      const now = Date.now();
      const elapsed = now - localLastTick;
      localLastTick = now;
      const info = getTurnInfo(moves.length);
      if (info.player === 'B') {
        localTimeB = Math.max(0, localTimeB - elapsed);
      } else {
        localTimeW = Math.max(0, localTimeW - elapsed);
      }
      updateClocks();
    }, 100);
  }

  function stopLocalTimer() {
    if (timerDisplayInterval) {
      clearInterval(timerDisplayInterval);
      timerDisplayInterval = null;
    }
  }

  function updateClocks() {
    const selfClock = document.getElementById('self-clock');
    const oppClock = document.getElementById('opponent-clock');
    if (localTimeB === null) {
      selfClock.textContent = '';
      oppClock.textContent = '';
      return;
    }

    const myTime = mySide === 'B' ? localTimeB : localTimeW;
    const oppTime = mySide === 'B' ? localTimeW : localTimeB;
    selfClock.textContent = formatTime(myTime);
    oppClock.textContent = formatTime(oppTime);

    // Highlight active clock
    const info = getTurnInfo(moves.length);
    const myActive = info.player === mySide && !gameOver;
    const oppActive = info.player !== mySide && !gameOver;
    selfClock.classList.toggle('active', myActive);
    oppClock.classList.toggle('active', oppActive);
    selfClock.classList.toggle('low-time', myTime < 30000 && myTime > 0);
    oppClock.classList.toggle('low-time', oppTime < 30000 && oppTime > 0);
  }

  // ===== Helpers =====
  function sideName(side) {
    return side === 'B' ? 'Black' : 'White';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== UI Updates =====
  function applyGameState(state) {
    gameState = state;
    config.boardSize = state.boardSize;
    config.winLength = state.winLength;

    board.clear();
    moves = state.moves;
    for (let i = 0; i < moves.length; i++) {
      const info = getTurnInfo(i);
      board.set(key(moves[i].q, moves[i].r), info.player);
    }

    gameOver = state.gameOver;
    winner = state.winner;
    winningCells = state.winningCells || [];

    // Sync timers
    localTimeB = state.timeB;
    localTimeW = state.timeW;
    localLastTick = Date.now();

    if (state.timeControl && state.status === 'playing' && !gameOver) {
      startLocalTimer();
    } else {
      stopLocalTimer();
    }

    resizeCanvas();
    updateGameUI();
    render();
    updateClocks();
    updateMoveList();
  }

  function updateGameUI() {
    const info = currentTurnInfo();
    const playerEl = document.getElementById('current-player');
    const piecesEl = document.getElementById('pieces-left');
    const pluralEl = document.getElementById('pieces-plural');
    const turnNumEl = document.getElementById('turn-number');
    const resultEl = document.getElementById('game-result');
    const resignBtn = document.getElementById('btn-resign');
    const backBtn = document.getElementById('btn-back-lobby');

    playerEl.textContent = sideName(info.player);
    playerEl.className = info.player === 'B' ? 'player-b' : 'player-w';
    piecesEl.textContent = info.piecesLeft;
    pluralEl.textContent = info.piecesLeft > 1 ? 's' : '';
    turnNumEl.textContent = `Turn ${info.turnNumber}`;

    const turnText = document.getElementById('turn-text');
    if (!gameOver && gameState && gameState.status === 'playing') {
      turnText.textContent = isMyTurn() ? 'Your turn' : "Opponent's turn";
    } else {
      turnText.textContent = 'to play';
    }

    if (gameOver) {
      resultEl.classList.remove('hidden', 'win-b', 'win-w', 'draw');
      if (winner) {
        let reason = '';
        if (gameState.winReason === 'timeout') reason = ' on time';
        else if (gameState.winReason === 'resignation') reason = ' by resignation';
        else if (gameState.winReason === 'disconnect') reason = ' (opponent disconnected)';
        resultEl.textContent = `${sideName(winner)} wins${reason}!`;
        resultEl.classList.add(winner === 'B' ? 'win-b' : 'win-w');
      } else {
        resultEl.textContent = 'Draw!';
        resultEl.classList.add('draw');
      }
      resignBtn.classList.add('hidden');
      backBtn.classList.remove('hidden');
    } else {
      resultEl.classList.add('hidden');
      resignBtn.classList.remove('hidden');
      backBtn.classList.add('hidden');
    }

    // Update rules win length
    document.querySelectorAll('.win-len').forEach(el => {
      el.textContent = config.winLength;
    });

    // Update player bars
    if (gameState) {
      const selfNameEl = document.getElementById('self-name');
      const oppNameEl = document.getElementById('opponent-name');
      const mySideName = mySide === 'B' ? gameState.playerNames.B : gameState.playerNames.W;
      const oppSideName = mySide === 'B' ? gameState.playerNames.W : gameState.playerNames.B;
      const oppSide = mySide === 'B' ? 'W' : 'B';
      selfNameEl.innerHTML = `<span class="side-badge side-${mySide.toLowerCase()}">${sideName(mySide)}</span>${escapeHtml(mySideName || 'You')}`;
      oppNameEl.innerHTML = `<span class="side-badge side-${oppSide.toLowerCase()}">${sideName(oppSide)}</span>${escapeHtml(oppSideName || 'Opponent')}`;
    }
  }

  function updateMoveList() {
    const listEl = document.getElementById('move-list');
    let html = '';
    for (let i = 0; i < moves.length; i++) {
      const info = getTurnInfo(i);
      const cls = info.player === 'B' ? 'move-b' : 'move-w';
      html += `<div class="move-entry ${cls}">${i + 1}. ${sideName(info.player)} (${moves[i].q}, ${moves[i].r})</div>`;
    }
    listEl.innerHTML = html;
    listEl.scrollTop = listEl.scrollHeight;
  }

  // ===== Lobby =====
  function renderGamesList(openGames) {
    const listEl = document.getElementById('games-list');
    if (openGames.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No open games. Create one!</div>';
      return;
    }
    listEl.innerHTML = openGames.map(g => {
      const timeStr = g.timeControl ? `${Math.floor(g.timeControl / 60)} min` : 'Untimed';
      return `
        <div class="game-row" data-game-id="${g.id}">
          <div class="game-row-info">
            <div class="game-row-name">${escapeHtml(g.creatorName)}</div>
            <div class="game-row-details">${g.boardSize}x${g.boardSize} board &middot; Win ${g.winLength} &middot; ${timeStr}</div>
          </div>
          <button class="game-row-join" data-game-id="${g.id}">Join</button>
        </div>
      `;
    }).join('');
  }

  function getPlayerName() {
    const el = document.getElementById('player-name');
    return (el.value || '').trim() || 'Anonymous';
  }

  function getSelectedTime() {
    const selected = document.querySelector('.time-btn.selected');
    if (!selected) return 300;
    const val = selected.dataset.time;
    if (val === '0') return null;
    if (val === 'custom') {
      const mins = parseInt(document.getElementById('custom-minutes').value) || 15;
      return Math.max(60, Math.min(10800, mins * 60));
    }
    return parseInt(val);
  }

  // ===== Lobby Events =====
  function bindLobby() {
    document.querySelectorAll('.time-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const custom = document.getElementById('custom-time-row');
        if (btn.dataset.time === 'custom') {
          custom.classList.remove('hidden');
        } else {
          custom.classList.add('hidden');
        }
      });
    });

    document.getElementById('btn-create').addEventListener('click', () => {
      const settings = {
        playerName: getPlayerName(),
        boardSize: parseInt(document.getElementById('create-board-size').value) || 11,
        winLength: parseInt(document.getElementById('create-win-length').value) || 6,
        timeControl: getSelectedTime(),
      };
      socket.emit('game:create', settings);
    });

    document.getElementById('games-list').addEventListener('click', (e) => {
      const btn = e.target.closest('.game-row-join');
      if (!btn) return;
      const gameId = btn.dataset.gameId;
      socket.emit('game:join', { gameId, playerName: getPlayerName() });
    });

    document.getElementById('btn-copy-link').addEventListener('click', () => {
      const input = document.getElementById('share-link');
      input.select();
      navigator.clipboard.writeText(input.value);
      document.getElementById('btn-copy-link').textContent = 'Copied!';
      setTimeout(() => {
        document.getElementById('btn-copy-link').textContent = 'Copy';
      }, 2000);
    });

    document.getElementById('btn-cancel-wait').addEventListener('click', () => {
      socket.disconnect();
      socket.connect();
      currentGameId = null;
      showView(lobbyView);
    });

    document.getElementById('btn-resign').addEventListener('click', () => {
      if (confirm('Are you sure you want to resign?')) {
        socket.emit('game:resign');
      }
    });

    document.getElementById('btn-back-lobby').addEventListener('click', () => {
      stopLocalTimer();
      currentGameId = null;
      gameState = null;
      showView(lobbyView);
      socket.emit('lobby:refresh');
    });

    document.getElementById('site-title').addEventListener('click', () => {
      if (currentGameId && !gameOver) return;
      stopLocalTimer();
      currentGameId = null;
      gameState = null;
      showView(lobbyView);
      socket.emit('lobby:refresh');
    });
  }

  // ===== Socket Events =====
  socket.on('lobby:games', (openGames) => {
    renderGamesList(openGames);
  });

  socket.on('game:created', ({ gameId, side }) => {
    currentGameId = gameId;
    mySide = side;
    showView(waitingView);
    const link = `${window.location.origin}${window.location.pathname}?game=${gameId}`;
    document.getElementById('share-link').value = link;
    const timeStr = getSelectedTime() ? `${Math.floor(getSelectedTime() / 60)} min` : 'Untimed';
    const bs = document.getElementById('create-board-size').value;
    const wl = document.getElementById('create-win-length').value;
    document.getElementById('game-settings-summary').textContent =
      `${bs}x${bs} board \u00B7 Win ${wl} \u00B7 ${timeStr}`;
  });

  socket.on('game:joined', ({ gameId, side }) => {
    currentGameId = gameId;
    mySide = side;
  });

  socket.on('game:state', (state) => {
    if (state.status === 'playing' || state.status === 'finished') {
      showView(gameView);
      if (!canvas) {
        canvas = document.getElementById('board');
        ctx = canvas.getContext('2d');
        canvas.addEventListener('click', handleClick);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);
      }
      applyGameState(state);
    }
  });

  socket.on('game:error', (msg) => {
    alert(msg);
  });

  // ===== Check URL for game invite =====
  function checkInviteLink() {
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get('game');
    if (gameId) {
      window.history.replaceState({}, '', window.location.pathname);
      const tryJoin = () => {
        socket.emit('game:join', { gameId, playerName: getPlayerName() });
      };
      if (socket.connected) {
        tryJoin();
      } else {
        socket.on('connect', tryJoin);
      }
    }
  }

  // ===== Init =====
  function init() {
    bindLobby();
    checkInviteLink();
    showView(lobbyView);

    const nameEl = document.getElementById('player-name');
    const savedName = localStorage.getItem('hex-player-name');
    if (savedName) nameEl.value = savedName;
    nameEl.addEventListener('input', () => {
      localStorage.setItem('hex-player-name', nameEl.value);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

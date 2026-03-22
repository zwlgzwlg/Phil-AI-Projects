const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ===== Game Storage =====
const games = new Map(); // gameId -> Game

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

// ===== Game Logic (server-authoritative) =====
function createGame(settings) {
  const id = generateId();
  const game = {
    id,
    boardSize: settings.boardSize || 11,
    winLength: settings.winLength || 6,
    timeControl: settings.timeControl, // null for untimed, else seconds
    createdBy: null, // socket id
    creatorName: settings.playerName || 'Anonymous',
    status: 'waiting', // waiting | playing | finished
    players: { B: null, W: null },
    playerNames: { B: null, W: null },
    board: new Map(),
    moves: [],
    gameOver: false,
    winner: null,
    winningCells: [],
    // Timer state (milliseconds remaining)
    timeB: settings.timeControl ? settings.timeControl * 1000 : null,
    timeW: settings.timeControl ? settings.timeControl * 1000 : null,
    lastTickTime: null,
    timerInterval: null,
    createdAt: Date.now(),
  };
  // Auto-place Black in center
  const cq = Math.floor(game.boardSize / 2);
  const cr = Math.floor(game.boardSize / 2);
  game.board.set(`${cq},${cr}`, 'B');
  game.moves.push({ q: cq, r: cr });
  games.set(id, game);
  return game;
}

function getTurnInfo(moveCount) {
  if (moveCount === 0) return { player: 'B', piecesLeft: 1, turnNumber: 1 };
  const adj = moveCount - 1;
  const turnIndex = Math.floor(adj / 2);
  const player = turnIndex % 2 === 0 ? 'W' : 'B';
  const piecesLeft = 2 - (adj % 2);
  const turnNumber = turnIndex + 2;
  return { player, piecesLeft, turnNumber };
}

function wrapCoord(q, r, size) {
  return {
    q: ((q % size) + size) % size,
    r: ((r % size) + size) % size,
  };
}

function checkWin(game, q, r, player) {
  const directions = [
    { dq: 1, dr: 0 },
    { dq: 0, dr: 1 },
    { dq: 1, dr: -1 },
  ];
  for (const { dq, dr } of directions) {
    const cells = [{ q, r }];
    for (let i = 1; i < game.winLength; i++) {
      const w = wrapCoord(q + dq * i, r + dr * i, game.boardSize);
      if (w.q === q && w.r === r) break;
      if (game.board.get(`${w.q},${w.r}`) !== player) break;
      cells.push({ q: w.q, r: w.r });
    }
    for (let i = 1; i < game.winLength; i++) {
      const w = wrapCoord(q - dq * i, r - dr * i, game.boardSize);
      if (w.q === q && w.r === r) break;
      if (game.board.get(`${w.q},${w.r}`) !== player) break;
      cells.unshift({ q: w.q, r: w.r });
    }
    if (cells.length >= game.winLength) {
      game.winningCells = cells.slice(0, game.winLength);
      return true;
    }
  }
  return false;
}

function placePiece(game, q, r) {
  if (game.gameOver) return false;
  const w = wrapCoord(q, r, game.boardSize);
  q = w.q; r = w.r;
  if (q < 0 || q >= game.boardSize || r < 0 || r >= game.boardSize) return false;
  if (game.board.has(`${q},${r}`)) return false;

  const info = getTurnInfo(game.moves.length);
  game.board.set(`${q},${r}`, info.player);
  game.moves.push({ q, r });

  if (checkWin(game, q, r, info.player)) {
    game.gameOver = true;
    game.winner = info.player;
    game.status = 'finished';
  } else if (game.moves.length >= game.boardSize * game.boardSize) {
    game.gameOver = true;
    game.winner = null;
    game.status = 'finished';
  }
  return true;
}

// ===== Timer =====
function startTimer(game) {
  if (!game.timeControl || game.timerInterval) return;
  game.lastTickTime = Date.now();
  game.timerInterval = setInterval(() => {
    tickTimer(game);
  }, 100);
}

function tickTimer(game) {
  if (game.gameOver || game.status !== 'playing') return;
  const now = Date.now();
  const elapsed = now - game.lastTickTime;
  game.lastTickTime = now;

  const info = getTurnInfo(game.moves.length);
  if (info.player === 'B') {
    game.timeB -= elapsed;
    if (game.timeB <= 0) {
      game.timeB = 0;
      game.gameOver = true;
      game.winner = 'W';
      game.status = 'finished';
      game.winReason = 'timeout';
      clearInterval(game.timerInterval);
      io.to(game.id).emit('game:state', serializeGame(game));
    }
  } else {
    game.timeW -= elapsed;
    if (game.timeW <= 0) {
      game.timeW = 0;
      game.gameOver = true;
      game.winner = 'B';
      game.status = 'finished';
      game.winReason = 'timeout';
      clearInterval(game.timerInterval);
      io.to(game.id).emit('game:state', serializeGame(game));
    }
  }
}

function stopTimer(game) {
  if (game.timerInterval) {
    // Flush one last tick so clocks are accurate
    tickTimer(game);
    clearInterval(game.timerInterval);
    game.timerInterval = null;
  }
}

function serializeGame(game) {
  return {
    id: game.id,
    boardSize: game.boardSize,
    winLength: game.winLength,
    timeControl: game.timeControl,
    status: game.status,
    playerNames: game.playerNames,
    moves: game.moves,
    gameOver: game.gameOver,
    winner: game.winner,
    winReason: game.winReason || null,
    winningCells: game.winningCells,
    turnInfo: getTurnInfo(game.moves.length),
    timeB: game.timeB,
    timeW: game.timeW,
  };
}

function getOpenGames() {
  const open = [];
  for (const game of games.values()) {
    if (game.status === 'waiting') {
      open.push({
        id: game.id,
        boardSize: game.boardSize,
        winLength: game.winLength,
        timeControl: game.timeControl,
        creatorName: game.creatorName,
        createdAt: game.createdAt,
      });
    }
  }
  return open.sort((a, b) => b.createdAt - a.createdAt);
}

// Clean up old finished games periodically
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 minutes
  for (const [id, game] of games) {
    if (game.status === 'finished' && game.createdAt < cutoff) {
      games.delete(id);
    }
    // Also clean stale waiting games older than 30 min
    if (game.status === 'waiting' && game.createdAt < cutoff) {
      games.delete(id);
    }
  }
}, 60 * 1000);

// ===== Socket.IO =====
io.on('connection', (socket) => {
  // Send open games on connect
  socket.emit('lobby:games', getOpenGames());

  socket.on('game:create', (settings) => {
    const game = createGame(settings);
    game.createdBy = socket.id;
    // Creator plays Black (auto-placed in center), opponent plays White and moves first
    game.players.B = socket.id;
    game.playerNames.B = settings.playerName || 'Anonymous';
    socket.join(game.id);
    socket.gameId = game.id;
    socket.playerSide = 'B';
    socket.emit('game:created', { gameId: game.id, side: 'B' });
    socket.emit('game:state', serializeGame(game));
    // Broadcast updated lobby
    io.emit('lobby:games', getOpenGames());
  });

  socket.on('game:join', ({ gameId, playerName }) => {
    const game = games.get(gameId);
    if (!game || game.status !== 'waiting') {
      socket.emit('game:error', 'Game not found or already started');
      return;
    }
    game.players.W = socket.id;
    game.playerNames.W = playerName || 'Anonymous';
    game.status = 'playing';
    socket.join(game.id);
    socket.gameId = game.id;
    socket.playerSide = 'W';
    socket.emit('game:joined', { gameId: game.id, side: 'W' });
    // Start timer - White moves first, so start the clock
    if (game.timeControl) {
      startTimer(game);
    }
    io.to(game.id).emit('game:state', serializeGame(game));
    io.emit('lobby:games', getOpenGames());
  });

  socket.on('game:move', ({ q, r }) => {
    const game = games.get(socket.gameId);
    if (!game || game.status !== 'playing') return;

    const info = getTurnInfo(game.moves.length);
    // Verify it's this player's turn
    if (game.players[info.player] !== socket.id) return;

    // Flush timer before processing move
    if (game.timeControl && game.timerInterval) {
      tickTimer(game);
    }

    if (placePiece(game, q, r)) {
      if (game.gameOver) {
        stopTimer(game);
      }
      io.to(game.id).emit('game:state', serializeGame(game));
    }
  });

  socket.on('game:resign', () => {
    const game = games.get(socket.gameId);
    if (!game || game.status !== 'playing') return;
    game.gameOver = true;
    game.winner = socket.playerSide === 'B' ? 'W' : 'B';
    game.winReason = 'resignation';
    game.status = 'finished';
    stopTimer(game);
    io.to(game.id).emit('game:state', serializeGame(game));
  });

  socket.on('lobby:refresh', () => {
    socket.emit('lobby:games', getOpenGames());
  });

  socket.on('disconnect', () => {
    const game = games.get(socket.gameId);
    if (!game) return;
    if (game.status === 'waiting') {
      // Creator left before anyone joined - remove game
      games.delete(game.id);
      io.emit('lobby:games', getOpenGames());
    } else if (game.status === 'playing') {
      // Player disconnected during game - opponent wins
      game.gameOver = true;
      game.winner = socket.playerSide === 'B' ? 'W' : 'B';
      game.winReason = 'disconnect';
      game.status = 'finished';
      stopTimer(game);
      io.to(game.id).emit('game:state', serializeGame(game));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Hex Noughts & Crosses server running on http://localhost:${PORT}`);
});

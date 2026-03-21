"""Hex noughts-and-crosses game environment for training."""

import numpy as np
from typing import Optional


class HexGame:
    """
    Hex grid noughts-and-crosses with make-two rule.

    Square torus of given size using axial coordinates.
    X is auto-placed in the centre. O then goes first, placing 2 pieces.
    After that players alternate placing 2 pieces each.
    Win by getting `win_length` in a row.

    Internal representation:
      board[r, q] = 0 (empty), 1 (player 1 / X), -1 (player 2 / O)

    Actions are cell indices 0..size*size-1, mapping to (q, r) = (idx % size, idx // size).
    Each "move" in the MCTS sense is a single piece placement.
    """

    # Three line directions in axial coordinates
    DIRECTIONS = [(1, 0), (0, 1), (1, -1)]

    def __init__(self, size: int = 11, win_length: int = 6):
        self.size = size
        self.width = size
        self.height = size
        self.win_length = win_length
        self.num_cells = size * size
        self.reset()

    def reset(self):
        self.board = np.zeros((self.size, self.size), dtype=np.int8)
        # Auto-place X in the centre
        c = self.size // 2
        self.board[c, c] = 1
        self.move_count = 1  # X's opening move is already done
        self.done = False
        self.winner = 0  # 0=none, 1=player1, -1=player2
        return self

    def clone(self) -> 'HexGame':
        g = HexGame.__new__(HexGame)
        g.size = self.size
        g.width = self.size
        g.height = self.size
        g.win_length = self.win_length
        g.num_cells = self.num_cells
        g.board = self.board.copy()
        g.move_count = self.move_count
        g.done = self.done
        g.winner = self.winner
        return g

    @property
    def current_player(self) -> int:
        """Returns 1 or -1."""
        if self.move_count == 0:
            return 1
        adj = self.move_count - 1
        turn_idx = adj // 2
        return -1 if turn_idx % 2 == 0 else 1

    @property
    def pieces_left_this_turn(self) -> int:
        if self.move_count == 0:
            return 1
        adj = self.move_count - 1
        return 2 - (adj % 2)

    def idx_to_qr(self, idx: int) -> tuple[int, int]:
        return idx % self.width, idx // self.width

    def qr_to_idx(self, q: int, r: int) -> int:
        return r * self.width + q

    def valid_actions(self) -> np.ndarray:
        """Returns boolean mask of valid actions (size num_cells)."""
        if self.done:
            return np.zeros(self.num_cells, dtype=bool)
        return self.board.reshape(-1) == 0

    def step(self, action: int) -> tuple[float, bool]:
        """
        Place one piece at `action` (cell index).
        Returns (reward, done).
        Reward is from the perspective of the player who just moved:
          +1 = win, -1 = loss, 0 = ongoing/draw.
        """
        if self.done:
            raise ValueError("Game is already over")

        q, r = self.idx_to_qr(action)
        if self.board[r, q] != 0:
            raise ValueError(f"Cell ({q}, {r}) is already occupied")

        player = self.current_player
        self.board[r, q] = player
        self.move_count += 1

        if self._check_win(q, r, player):
            self.done = True
            self.winner = player
            return 1.0, True

        if self.move_count >= self.num_cells:
            self.done = True
            self.winner = 0
            return 0.0, True

        return 0.0, False

    def _check_win(self, q: int, r: int, player: int) -> bool:
        for dq, dr in self.DIRECTIONS:
            count = 1
            # Positive direction
            for i in range(1, self.win_length):
                nq = (q + dq * i) % self.width
                nr = (r + dr * i) % self.height
                if self.board[nr, nq] != player:
                    break
                count += 1
            # Negative direction
            for i in range(1, self.win_length):
                nq = (q - dq * i) % self.width
                nr = (r - dr * i) % self.height
                if self.board[nr, nq] != player:
                    break
                count += 1
            if count >= self.win_length:
                return True
        return False

    def get_canonical_board(self) -> np.ndarray:
        """
        Returns board from current player's perspective.
        Current player's pieces = 1, opponent's = -1.
        """
        return self.board * self.current_player

    def get_nn_input(self) -> np.ndarray:
        """
        Returns neural network input tensor of shape (C, H, W).
        Channels:
          0: current player's pieces (1 where present)
          1: opponent's pieces (1 where present)
          2: constant plane = 1 if current player is player 1, else 0
          3: pieces left this turn (0.5 for 1, 1.0 for 2)
        """
        player = self.current_player
        mine = (self.board == player).astype(np.float32)
        theirs = (self.board == -player).astype(np.float32)
        turn_plane = np.full_like(mine, 1.0 if player == 1 else 0.0)
        pieces_plane = np.full_like(mine, self.pieces_left_this_turn / 2.0)
        return np.stack([mine, theirs, turn_plane, pieces_plane], axis=0)

    def __repr__(self) -> str:
        symbols = {0: '.', 1: 'X', -1: 'O'}
        rows = []
        for r in range(self.height):
            prefix = ' ' * r
            cells = ' '.join(symbols[self.board[r, q]] for q in range(self.width))
            rows.append(prefix + cells)
        return '\n'.join(rows)

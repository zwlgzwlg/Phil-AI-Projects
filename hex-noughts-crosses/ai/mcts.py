"""Monte Carlo Tree Search with neural network guidance (AlphaZero-style).

All values in the tree are stored from player 1's (X's) perspective.
This avoids sign errors with the make-two rule where the same player
moves twice in a row (so parent and child can have the same current_player).
"""

import math
import numpy as np
import torch
from game_env import HexGame


class MCTSNode:
    __slots__ = ['parent', 'action', 'prior', 'visit_count', 'value_sum', 'children', 'game']

    def __init__(self, game: HexGame, parent=None, action: int = -1, prior: float = 0.0):
        self.game = game
        self.parent = parent
        self.action = action
        self.prior = prior
        self.visit_count = 0
        self.value_sum = 0.0  # accumulated from player 1's perspective
        self.children = []

    @property
    def q_value(self) -> float:
        """Mean value from player 1's perspective."""
        if self.visit_count == 0:
            return 0.0
        return self.value_sum / self.visit_count

    def ucb_score(self, c_puct: float = 1.5) -> float:
        # q_value is from player 1's perspective.
        # The parent wants to maximise for their own player, so multiply
        # by parent's current_player (+1 for X, -1 for O) to get
        # "how good is this child for me".
        q = self.q_value * self.parent.game.current_player
        prior_score = c_puct * self.prior * math.sqrt(self.parent.visit_count) / (1 + self.visit_count)
        return q + prior_score

    def is_expanded(self) -> bool:
        return len(self.children) > 0

    def expand(self, policy: np.ndarray):
        """Expand node using policy from neural network."""
        valid = self.game.valid_actions()
        # Mask and renormalize
        policy = policy * valid
        policy_sum = policy.sum()
        if policy_sum > 0:
            policy /= policy_sum
        else:
            # Uniform over valid
            policy = valid.astype(np.float32)
            policy /= policy.sum()

        for action in range(len(policy)):
            if valid[action]:
                child_game = self.game.clone()
                child_game.step(action)
                child = MCTSNode(child_game, parent=self, action=action, prior=policy[action])
                self.children.append(child)

    def select_child(self) -> 'MCTSNode':
        return max(self.children, key=lambda c: c.ucb_score())


class MCTS:
    def __init__(self, model, device: torch.device, num_simulations: int = 400,
                 c_puct: float = 1.5, temperature: float = 1.0):
        self.model = model
        self.device = device
        self.num_simulations = num_simulations
        self.c_puct = c_puct
        self.temperature = temperature

    @torch.no_grad()
    def _evaluate(self, game: HexGame):
        """Get policy and value from the neural network.
        Returns (policy, value) where value is from player 1's perspective."""
        nn_input = torch.from_numpy(game.get_nn_input()).unsqueeze(0).to(self.device)
        log_policy, value = self.model(nn_input)
        policy = torch.exp(log_policy).squeeze(0).cpu().numpy()
        # NN returns value from current_player's perspective; convert to player 1's
        value = value.item() * game.current_player
        return policy, value

    def search(self, game: HexGame) -> np.ndarray:
        """
        Run MCTS from the given game state.
        Returns visit count distribution over actions (size num_cells).
        """
        root = MCTSNode(game.clone())

        # Expand root
        policy, _ = self._evaluate(root.game)
        root.expand(policy)

        for _ in range(self.num_simulations):
            node = root

            # SELECT
            while node.is_expanded() and not node.game.done:
                node = node.select_child()

            # EVALUATE
            if node.game.done:
                # Terminal value from player 1's perspective
                value = float(node.game.winner)  # +1 if X won, -1 if O won, 0 if draw
            else:
                # Expand and evaluate
                policy, value = self._evaluate(node.game)
                node.expand(policy)

            # BACKPROPAGATE
            # All values are from player 1's perspective - no flipping needed
            while node is not None:
                node.visit_count += 1
                node.value_sum += value
                node = node.parent

        # Build visit count distribution
        visits = np.zeros(game.num_cells, dtype=np.float32)
        for child in root.children:
            visits[child.action] = child.visit_count

        if self.temperature == 0:
            # Greedy
            best = np.argmax(visits)
            action_probs = np.zeros_like(visits)
            action_probs[best] = 1.0
        else:
            visits_temp = visits ** (1.0 / self.temperature)
            total = visits_temp.sum()
            action_probs = visits_temp / total if total > 0 else visits_temp

        return action_probs

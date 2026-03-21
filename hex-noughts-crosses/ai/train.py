"""AlphaZero-style training loop for hex noughts-and-crosses."""

import os
import time
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torch.utils.tensorboard import SummaryWriter
from tqdm import tqdm

from game_env import HexGame
from model import HexNet
from mcts import MCTS


# ===== Configuration =====
class Config:
    # Board
    board_size = 11
    win_length = 6

    # Network
    num_channels = 128
    num_res_blocks = 10

    # MCTS
    num_simulations = 400
    c_puct = 1.5
    temperature_moves = 15  # use temperature=1 for first N moves, then 0

    # Training
    num_iterations = 100
    games_per_iteration = 100
    epochs_per_iteration = 10
    batch_size = 64
    learning_rate = 0.001
    weight_decay = 1e-4
    replay_buffer_size = 50000

    # Evaluation
    eval_games = 20
    eval_simulations = 200

    # System
    device = 'cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu'
    num_workers = 0
    checkpoint_dir = 'checkpoints'


# ===== Replay Buffer =====
class ReplayBuffer:
    def __init__(self, max_size: int):
        self.max_size = max_size
        self.states = []
        self.policies = []
        self.values = []

    def add(self, state: np.ndarray, policy: np.ndarray, value: float):
        self.states.append(state)
        self.policies.append(policy)
        self.values.append(value)
        if len(self.states) > self.max_size:
            self.states.pop(0)
            self.policies.pop(0)
            self.values.pop(0)

    def __len__(self):
        return len(self.states)


class ReplayDataset(Dataset):
    def __init__(self, buffer: ReplayBuffer):
        self.states = np.array(buffer.states)
        self.policies = np.array(buffer.policies)
        self.values = np.array(buffer.values, dtype=np.float32)

    def __len__(self):
        return len(self.states)

    def __getitem__(self, idx):
        return (
            torch.from_numpy(self.states[idx]),
            torch.from_numpy(self.policies[idx]),
            torch.tensor(self.values[idx]),
        )


# ===== Self-Play =====
def self_play_game(mcts: MCTS, config: Config) -> list[tuple[np.ndarray, np.ndarray, int]]:
    """Play one game via self-play. Returns list of (state, policy, outcome)."""
    game = HexGame(config.board_size, config.win_length)
    history = []  # (nn_input, mcts_policy, current_player)

    move_num = 0
    while not game.done:
        temp = 1.0 if move_num < config.temperature_moves else 0.0
        mcts.temperature = temp

        action_probs = mcts.search(game)
        state = game.get_nn_input()
        history.append((state, action_probs, game.current_player))

        # Sample action
        if temp > 0:
            action = np.random.choice(len(action_probs), p=action_probs)
        else:
            action = np.argmax(action_probs)

        game.step(action)
        move_num += 1

    # Assign outcomes
    result = []
    for state, policy, player in history:
        if game.winner == 0:
            value = 0.0
        elif game.winner == player:
            value = 1.0
        else:
            value = -1.0
        result.append((state, policy, value))

    return result


# ===== Training =====
def train_network(model: HexNet, buffer: ReplayBuffer, config: Config,
                  device: torch.device) -> dict:
    """Train the network on replay buffer data. Returns loss dict."""
    dataset = ReplayDataset(buffer)
    loader = DataLoader(dataset, batch_size=config.batch_size, shuffle=True,
                        num_workers=config.num_workers)

    optimizer = optim.Adam(model.parameters(), lr=config.learning_rate,
                           weight_decay=config.weight_decay)

    model.train()
    total_policy_loss = 0
    total_value_loss = 0
    num_batches = 0

    for epoch in range(config.epochs_per_iteration):
        for states, target_policies, target_values in loader:
            states = states.to(device)
            target_policies = target_policies.to(device)
            target_values = target_values.to(device).unsqueeze(1)

            log_policy, value = model(states)

            # Policy loss: cross-entropy
            policy_loss = -torch.sum(target_policies * log_policy) / states.size(0)
            # Value loss: MSE
            value_loss = nn.functional.mse_loss(value, target_values)

            loss = policy_loss + value_loss

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            total_policy_loss += policy_loss.item()
            total_value_loss += value_loss.item()
            num_batches += 1

    return {
        'policy_loss': total_policy_loss / max(num_batches, 1),
        'value_loss': total_value_loss / max(num_batches, 1),
    }


# ===== Main Training Loop =====
def main():
    config = Config()
    device = torch.device(config.device)
    print(f"Using device: {device}")

    os.makedirs(config.checkpoint_dir, exist_ok=True)
    writer = SummaryWriter()

    model = HexNet(
        board_size=config.board_size,
        num_channels=config.num_channels,
        num_res_blocks=config.num_res_blocks,
    ).to(device)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Model parameters: {total_params:,}")

    buffer = ReplayBuffer(config.replay_buffer_size)

    for iteration in range(1, config.num_iterations + 1):
        print(f"\n{'='*60}")
        print(f"Iteration {iteration}/{config.num_iterations}")
        print(f"{'='*60}")

        # Self-play
        model.eval()
        mcts = MCTS(model, device, num_simulations=config.num_simulations, c_puct=config.c_puct)

        games_data = []
        t0 = time.time()
        for g in tqdm(range(config.games_per_iteration), desc="Self-play"):
            game_data = self_play_game(mcts, config)
            games_data.extend(game_data)

        elapsed = time.time() - t0
        print(f"Self-play: {config.games_per_iteration} games, "
              f"{len(games_data)} positions, {elapsed:.1f}s")

        # Add to buffer
        for state, policy, value in games_data:
            buffer.add(state, policy, value)

        print(f"Buffer size: {len(buffer)}")

        # Train
        if len(buffer) >= config.batch_size:
            losses = train_network(model, buffer, config, device)
            print(f"Policy loss: {losses['policy_loss']:.4f}, "
                  f"Value loss: {losses['value_loss']:.4f}")

            writer.add_scalar('loss/policy', losses['policy_loss'], iteration)
            writer.add_scalar('loss/value', losses['value_loss'], iteration)

        # Save checkpoint
        if iteration % 5 == 0:
            path = os.path.join(config.checkpoint_dir, f'model_iter{iteration}.pt')
            torch.save({
                'iteration': iteration,
                'model_state_dict': model.state_dict(),
                'config': {
                    'board_size': config.board_size,
                    'win_length': config.win_length,
                    'num_channels': config.num_channels,
                    'num_res_blocks': config.num_res_blocks,
                },
            }, path)
            print(f"Saved checkpoint: {path}")

    writer.close()
    print("\nTraining complete!")


if __name__ == '__main__':
    main()

"""Minimal Flask server to play against a trained hex noughts-and-crosses model."""

import argparse
import sys
import numpy as np
import torch
from flask import Flask, request, jsonify

from game_env import HexGame
from model import HexNet
from mcts import MCTS

app = Flask(__name__)

model = None
device = None
checkpoint_info = None


def load_model(checkpoint_path):
    global model, device, checkpoint_info
    device = torch.device(
        'cuda' if torch.cuda.is_available()
        else 'mps' if torch.backends.mps.is_available()
        else 'cpu'
    )
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    cfg = checkpoint['config']
    checkpoint_info = cfg

    model = HexNet(
        board_size=cfg['board_size'],
        num_channels=cfg.get('num_channels', 128),
        num_res_blocks=cfg.get('num_res_blocks', 10),
    ).to(device)
    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()
    print(f"Loaded model from {checkpoint_path} (iteration {checkpoint.get('iteration', '?')})")
    print(f"Board size: {cfg['board_size']}, device: {device}")


def reconstruct_game(moves, board_size, win_length):
    """Replay a move list to reconstruct the game state."""
    game = HexGame(size=board_size, win_length=win_length)
    for q, r in moves:
        idx = game.qr_to_idx(q, r)
        game.step(idx)
    return game


def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
    return response


@app.after_request
def after_request(response):
    return add_cors(response)


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'config': checkpoint_info})


@app.route('/api/move', methods=['POST', 'OPTIONS'])
def get_move():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.json
    moves = data.get('moves', [])
    board_size = data.get('board_size', 11)
    win_length = data.get('win_length', 6)
    num_simulations = data.get('num_simulations', 400)

    game = reconstruct_game(moves, board_size, win_length)
    if game.done:
        return jsonify({'error': 'Game is already over'}), 400

    mcts = MCTS(model, device, num_simulations=num_simulations, c_puct=1.5, temperature=0.0)
    action_probs = mcts.search(game)
    action = int(np.argmax(action_probs))
    q, r = game.idx_to_qr(action)

    # Raw network evaluation
    with torch.no_grad():
        nn_input = torch.from_numpy(game.get_nn_input()).unsqueeze(0).to(device)
        log_policy, value = model(nn_input)
        raw_policy = torch.exp(log_policy).squeeze(0).cpu().numpy()
        raw_value = value.item()

    # Convert value to X's perspective (player 1)
    if game.current_player == -1:
        raw_value = -raw_value

    # Build policy map (only valid cells)
    valid = game.valid_actions()
    policy_map = {}
    for idx in range(game.num_cells):
        if valid[idx]:
            pq, pr = game.idx_to_qr(idx)
            policy_map[f"{pq},{pr}"] = float(raw_policy[idx])

    return jsonify({
        'action': [int(q), int(r)],
        'value': float(raw_value),
        'policy': policy_map,
        'visit_counts': {
            f"{game.idx_to_qr(i)[0]},{game.idx_to_qr(i)[1]}": float(action_probs[i])
            for i in range(len(action_probs)) if action_probs[i] > 0
        },
    })


@app.route('/api/evaluate', methods=['POST', 'OPTIONS'])
def evaluate():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.json
    moves = data.get('moves', [])
    board_size = data.get('board_size', 11)
    win_length = data.get('win_length', 6)

    game = reconstruct_game(moves, board_size, win_length)

    with torch.no_grad():
        nn_input = torch.from_numpy(game.get_nn_input()).unsqueeze(0).to(device)
        log_policy, value = model(nn_input)
        raw_policy = torch.exp(log_policy).squeeze(0).cpu().numpy()
        raw_value = value.item()

    # Convert value to X's perspective
    if game.current_player == -1:
        raw_value = -raw_value

    valid = game.valid_actions()
    policy_map = {}
    for idx in range(game.num_cells):
        if valid[idx]:
            q, r = game.idx_to_qr(idx)
            policy_map[f"{q},{r}"] = float(raw_policy[idx])

    return jsonify({
        'value': float(raw_value),
        'policy': policy_map,
    })


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--checkpoint', required=True, help='Path to model checkpoint')
    parser.add_argument('--port', type=int, default=5000)
    args = parser.parse_args()

    load_model(args.checkpoint)
    app.run(host='0.0.0.0', port=args.port, debug=False)

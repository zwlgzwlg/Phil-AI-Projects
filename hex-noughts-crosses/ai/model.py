"""AlphaZero-style neural network for hex noughts-and-crosses."""

import torch
import torch.nn as nn
import torch.nn.functional as F


class ResBlock(nn.Module):
    def __init__(self, channels: int):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x):
        residual = x
        x = F.relu(self.bn1(self.conv1(x)))
        x = self.bn2(self.conv2(x))
        x = F.relu(x + residual)
        return x


class HexNet(nn.Module):
    """
    Dual-headed network: policy + value.

    Input: (batch, 4, H, W)  — from HexGame.get_nn_input()
    Policy output: (batch, H*W) — log-probabilities over cells
    Value output: (batch, 1)   — predicted value in [-1, 1]
    """

    def __init__(self, board_size: int = 11,
                 num_channels: int = 128, num_res_blocks: int = 10,
                 input_channels: int = 4):
        super().__init__()
        self.board_size = board_size
        self.num_cells = board_size * board_size

        # Initial convolution
        self.conv_in = nn.Conv2d(input_channels, num_channels, 3, padding=1, bias=False)
        self.bn_in = nn.BatchNorm2d(num_channels)

        # Residual tower
        self.res_blocks = nn.Sequential(
            *[ResBlock(num_channels) for _ in range(num_res_blocks)]
        )

        # Policy head
        self.policy_conv = nn.Conv2d(num_channels, 32, 1, bias=False)
        self.policy_bn = nn.BatchNorm2d(32)
        self.policy_fc = nn.Linear(32 * self.num_cells, self.num_cells)

        # Value head
        self.value_conv = nn.Conv2d(num_channels, 1, 1, bias=False)
        self.value_bn = nn.BatchNorm2d(1)
        self.value_fc1 = nn.Linear(self.num_cells, 256)
        self.value_fc2 = nn.Linear(256, 1)

    def forward(self, x):
        # Trunk
        x = F.relu(self.bn_in(self.conv_in(x)))
        x = self.res_blocks(x)

        # Policy
        p = F.relu(self.policy_bn(self.policy_conv(x)))
        p = p.view(p.size(0), -1)
        p = self.policy_fc(p)
        log_policy = F.log_softmax(p, dim=1)

        # Value
        v = F.relu(self.value_bn(self.value_conv(x)))
        v = v.view(v.size(0), -1)
        v = F.relu(self.value_fc1(v))
        v = torch.tanh(self.value_fc2(v))

        return log_policy, v

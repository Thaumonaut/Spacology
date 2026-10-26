#!/bin/zsh
# Headless hardware-GPU walk capture: tools/__mountain-shot.sh <port> <out.png> <query>
cd /Users/jek/Documents/Personal/Projects/Spacology/Spacology/.claude/worktrees/voxel-rendering
export NODE_OPTIONS="--require=$PWD/artifacts/voxel-rendering/headless-hardware.cjs"
node tools/__walk-view.cjs "$@"

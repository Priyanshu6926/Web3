#!/usr/bin/env bash
set -e

# Load contracts/.env if present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if [ -z "$SEPOLIA_RPC_URL" ]; then
  echo "Error: SEPOLIA_RPC_URL is not set in contracts/.env or environment."
  exit 1
fi

if [ -z "$PRIVATE_KEY" ]; then
  echo "Error: PRIVATE_KEY is not set in contracts/.env or environment."
  exit 1
fi

VERIFY_FLAG=""
if [ -n "$ETHERSCAN_API_KEY" ]; then
  VERIFY_FLAG="--verify --etherscan-api-key $ETHERSCAN_API_KEY"
fi

echo "Deploying OpenFund to Sepolia..."
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast \
  $VERIFY_FLAG \
  -vvvv

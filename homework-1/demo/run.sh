#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dev}"

case "$MODE" in
  dev)
    echo "Starting dev server..."
    npm run dev
    ;;
  test)
    echo "Running unit + integration tests..."
    npm test
    ;;
  seed)
    echo "Starting dev server with seed data..."
    npm run seed
    ;;
  e2e)
    echo "Running Postman/Newman e2e tests..."
    npm run test:e2e
    ;;
  *)
    echo "Usage: ./run.sh [dev|test|seed|e2e]"
    exit 1
    ;;
esac

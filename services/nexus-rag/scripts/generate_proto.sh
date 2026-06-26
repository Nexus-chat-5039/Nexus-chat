#!/usr/bin/env bash
# Generate Python gRPC stubs from proto definitions.
# Run from the repo root: ./services/nexus-rag/scripts/generate_proto.sh
# Or from the service directory: ./scripts/generate_proto.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(cd "$SERVICE_DIR/../.." && pwd)"

PROTO_DIR="$REPO_ROOT/proto"
OUT_DIR="$SERVICE_DIR/proto_out"

echo "=== nexus-rag: Generating Python gRPC stubs ==="
echo "  Proto source: $PROTO_DIR"
echo "  Output dir:   $OUT_DIR"

# Ensure output directory exists
mkdir -p "$OUT_DIR"

# Generate stubs
python -m grpc_tools.protoc \
    -I"$PROTO_DIR" \
    --python_out="$OUT_DIR" \
    --grpc_python_out="$OUT_DIR" \
    "$PROTO_DIR/rag/rag.proto"

# Create __init__.py for importability
touch "$OUT_DIR/__init__.py"

echo "=== Proto stubs generated successfully ==="
echo "  Files:"
ls -la "$OUT_DIR"

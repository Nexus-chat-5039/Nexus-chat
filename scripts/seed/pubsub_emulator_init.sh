#!/bin/sh
# Seed the Pub/Sub emulator with topics and subscriptions needed for local dev.
# Uses Python's urllib (no external deps) since BusyBox wget lacks PUT/POST body support.

set -eu

EMULATOR_HOST="${PUBSUB_EMULATOR_HOST:-localhost:8085}"
PROJECT_ID="${GCP_PROJECT_ID:-nexus-local}"

echo "=== Seeding Pub/Sub emulator at ${EMULATOR_HOST} ==="

# Wait for the emulator to be ready
i=1
while [ "$i" -le 30 ]; do
  if python3 -c "
import urllib.request
try:
    urllib.request.urlopen('http://${EMULATOR_HOST}')
except Exception:
    exit(1)
" 2>/dev/null; then
    echo "Emulator is ready."
    break
  fi
  echo "Waiting for emulator (attempt $i/30)..."
  sleep 1
  i=$((i + 1))
done

# Use Python for HTTP calls since BusyBox wget doesn't support PUT with body
python3 << 'PYEOF'
import urllib.request
import json
import os

host = os.environ.get("PUBSUB_EMULATOR_HOST", "localhost:8085")
project = os.environ.get("GCP_PROJECT_ID", "nexus-local")
base = f"http://{host}/v1/projects/{project}"

topics = ["ai.inference", "embed.messages", "notifications", "billing.events", "deadletter"]

subs = {
    "ai-inference-sub": "ai.inference",
    "embed-messages-sub": "embed.messages",
    "notifications-sub": "notifications",
    "billing-events-sub": "billing.events",
}

for topic in topics:
    url = f"{base}/topics/{topic}"
    try:
        req = urllib.request.Request(url, method="PUT", data=b"")
        urllib.request.urlopen(req)
        print(f"  Created topic: {topic}")
    except Exception as e:
        print(f"  Topic {topic}: {e}")

for sub_name, topic_name in subs.items():
    url = f"{base}/subscriptions/{sub_name}"
    body = json.dumps({"topic": f"projects/{project}/topics/{topic_name}"}).encode()
    try:
        req = urllib.request.Request(url, method="PUT", data=body,
                                     headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req)
        print(f"  Created subscription: {sub_name} -> {topic_name}")
    except Exception as e:
        print(f"  Subscription {sub_name}: {e}")

PYEOF

echo "=== Pub/Sub emulator seeded successfully ==="

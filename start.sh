#!/bin/bash
# Start Server
echo "Starting Backend Server..."
cd nexus-rag

# Set up venv if it doesn't exist
if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
else
  source venv/bin/activate
fi

uvicorn app.main:app --reload --host 0.0.0.0 --port 8080 &
SERVER_PID=$!

# Start Client
echo "Starting Frontend Client..."
cd ../client
npm run dev &
CLIENT_PID=$!

# Cleanup on exit
trap "kill $SERVER_PID $CLIENT_PID" EXIT

wait

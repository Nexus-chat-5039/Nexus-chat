# ============================================================
# nexus-rag Dockerfile
# Build context: REPO ROOT (not service directory)
#
# Usage:
#   docker build -f services/nexus-rag/Dockerfile -t nexus-rag .
#   docker-compose up nexus-rag   (context set in docker-compose.yml)
# ============================================================

FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for compiling grpc/torch native extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (cached layer — changes rarely)
COPY services/nexus-rag/requirements.txt .
# Install PyTorch CPU-only build to keep image size manageable
RUN pip install torch==2.2.1 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Generate gRPC Python stubs from proto definitions
COPY proto/ /app/proto/
RUN mkdir -p /app/proto_out && \
    python -m grpc_tools.protoc \
        -I/app/proto \
        --python_out=/app/proto_out \
        --grpc_python_out=/app/proto_out \
        /app/proto/rag/rag.proto && \
    touch /app/proto_out/__init__.py

# Copy service source code
COPY services/nexus-rag/app/ /app/app/

# Expose ports: gRPC (50051) + HTTP health probes (8000)
EXPOSE 50051 8000

# Set Python path so both app/ and proto_out/ are importable
ENV PYTHONPATH=/app

# Health check — hit the FastAPI liveness endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Start the dual-server entrypoint (gRPC + HTTP)
CMD ["python", "app/main.py"]

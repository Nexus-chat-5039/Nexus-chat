"""
nexus-rag service entrypoint.
Runs both a gRPC server (RAG pipeline) and a FastAPI HTTP server (health/readiness probes).
"""
import asyncio
import logging
import signal
import sys
import os
import threading

import grpc
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI

# Add proto generated paths
sys.path.append(os.path.join(os.path.dirname(__file__), "../proto_out"))

import rag_pb2_grpc
from app.grpc_server import RAGServiceServicer
from app.core.config import GRPC_PORT, HTTP_PORT, GRPC_MAX_WORKERS

logger = logging.getLogger(__name__)

# Global references for health checks and graceful shutdown
_qdrant_retriever = None
_grpc_server_ref = None
_grpc_loop = None


# ------------------------------------------------------------------
# FastAPI app with lifecycle hooks
# ------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle for FastAPI."""
    logger.info("=" * 50)
    logger.info("nexus-rag service starting...")
    logger.info("=" * 50)
    yield
    logger.info("nexus-rag service shutting down...")
    # Gracefully stop gRPC server if running
    if _grpc_server_ref and _grpc_loop:
        try:
            future = asyncio.run_coroutine_threadsafe(
                _grpc_server_ref.stop(grace=5), _grpc_loop
            )
            future.result(timeout=10)
            logger.info("gRPC server stopped gracefully.")
        except Exception as e:
            logger.warning(f"gRPC shutdown error (non-fatal): {e}")
    logger.info("Shutdown complete.")


app = FastAPI(title="nexus-rag", lifespan=lifespan)


@app.get("/health")
def health_check():
    """
    Liveness probe — is the process alive and responsive?
    Returns 200 even if Qdrant is down (so K8s doesn't kill the pod during Qdrant maintenance).
    """
    return {"status": "healthy", "service": "nexus-rag"}


@app.get("/ready")
def readiness_check():
    """
    Readiness probe — is the service ready to handle gRPC requests?
    Checks Qdrant connectivity. K8s will stop routing traffic if this fails.
    """
    qdrant_ok = False
    if _qdrant_retriever:
        try:
            qdrant_ok = _qdrant_retriever.health_check()
        except Exception:
            qdrant_ok = False

    status = "ready" if qdrant_ok else "not_ready"
    return {
        "status": status,
        "service": "nexus-rag",
        "qdrant": "connected" if qdrant_ok else "disconnected",
    }


# ------------------------------------------------------------------
# gRPC server
# ------------------------------------------------------------------

async def serve_grpc():
    """Start the async gRPC server."""
    global _grpc_server_ref, _qdrant_retriever

    server = grpc.aio.server(
        options=[
            ("grpc.max_send_message_length", 50 * 1024 * 1024),  # 50 MB
            ("grpc.max_receive_message_length", 50 * 1024 * 1024),
        ]
    )

    # Initialize the servicer (loads ML models + connects to Qdrant)
    servicer = RAGServiceServicer()
    _qdrant_retriever = servicer.qdrant  # Expose for health checks

    rag_pb2_grpc.add_RAGServiceServicer_to_server(servicer, server)
    server.add_insecure_port(f"[::]:{GRPC_PORT}")

    _grpc_server_ref = server

    logger.info(f"gRPC server starting on port {GRPC_PORT}...")
    await server.start()
    logger.info(f"gRPC server listening on port {GRPC_PORT}")
    await server.wait_for_termination()


def start_grpc_loop():
    """Run the gRPC server in a dedicated event loop on a background thread."""
    global _grpc_loop
    _grpc_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_grpc_loop)
    _grpc_loop.run_until_complete(serve_grpc())


# ------------------------------------------------------------------
# Entrypoint
# ------------------------------------------------------------------

if __name__ == "__main__":
    # Handle SIGTERM for graceful container shutdown
    def handle_signal(signum, frame):
        sig_name = signal.Signals(signum).name
        logger.info(f"Received {sig_name}, initiating shutdown...")
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    # Start gRPC server in a background thread
    grpc_thread = threading.Thread(target=start_grpc_loop, daemon=True, name="grpc-server")
    grpc_thread.start()

    # Start FastAPI (health/readiness probes) on the main thread
    logger.info(f"HTTP server starting on port {HTTP_PORT} (health/readiness probes)...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=HTTP_PORT,
        log_level="info",
    )

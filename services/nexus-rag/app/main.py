import asyncio
import logging
import os
import signal
import sys
import threading
from contextlib import asynccontextmanager

import grpc
import uvicorn
from fastapi import FastAPI

sys.path.insert(0, "/app/proto_out")
sys.path.insert(0, "/app")

import rag_pb2_grpc
from app.grpc_server import RAGServiceServicer
from app.core.config import GRPC_PORT, GRPC_MAX_WORKERS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

_qdrant_retriever = None
_grpc_server_ref = None
_grpc_loop = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("nexus-rag HTTP service starting...")
    yield
    logger.info("nexus-rag service shutting down...")

    global _grpc_server_ref, _grpc_loop

    if _grpc_server_ref and _grpc_loop:
        try:
            future = asyncio.run_coroutine_threadsafe(
                _grpc_server_ref.stop(grace=5),
                _grpc_loop,
            )
            future.result(timeout=10)
            logger.info("gRPC server stopped gracefully.")
        except Exception as exc:
            logger.warning("gRPC shutdown error: %s", exc)


app = FastAPI(
    title="nexus-rag",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "nexus-rag",
    }


@app.get("/ready")
async def readiness_check():
    qdrant_ok = False

    if _qdrant_retriever is not None:
        try:
            qdrant_ok = _qdrant_retriever.health_check()
        except Exception:
            qdrant_ok = False

    return {
        "status": "ready" if qdrant_ok else "not_ready",
        "service": "nexus-rag",
        "qdrant": "connected" if qdrant_ok else "disconnected",
    }


async def serve_grpc():
    global _grpc_server_ref
    global _qdrant_retriever

    server = grpc.aio.server(
        options=[
            ("grpc.max_send_message_length", 50 * 1024 * 1024),
            ("grpc.max_receive_message_length", 50 * 1024 * 1024),
        ]
    )

    servicer = RAGServiceServicer()

    _qdrant_retriever = servicer.qdrant

    rag_pb2_grpc.add_RAGServiceServicer_to_server(
        servicer,
        server,
    )

    grpc_port = int(os.environ.get("GRPC_PORT", GRPC_PORT))

    server.add_insecure_port(
        f"0.0.0.0:{grpc_port}"
    )

    _grpc_server_ref = server

    logger.info(
        "gRPC server starting on port %s...",
        grpc_port,
    )

    await server.start()

    logger.info(
        "gRPC server listening on port %s",
        grpc_port,
    )

    await server.wait_for_termination()


def start_grpc_loop():
    global _grpc_loop

    _grpc_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_grpc_loop)

    try:
        _grpc_loop.run_until_complete(
            serve_grpc()
        )
    except Exception:
        logger.exception("gRPC server failed")
    finally:
        _grpc_loop.close()


def handle_signal(signum, frame):
    logger.info(
        "Received %s, shutting down...",
        signal.Signals(signum).name,
    )
    raise SystemExit(0)


def main():
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    grpc_thread = threading.Thread(
        target=start_grpc_loop,
        daemon=True,
        name="grpc-server",
    )

    grpc_thread.start()

    http_port = int(
        os.environ.get("PORT", "8080")
    )

    logger.info(
        "FastAPI server starting on port %s...",
        http_port,
    )

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=http_port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
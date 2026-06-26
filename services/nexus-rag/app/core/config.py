"""
Configuration management for nexus-rag service.
All settings are loaded from environment variables with sensible defaults.
"""
import os
import logging

# ============ Logging ============
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    handlers=[logging.StreamHandler()],
)

logger = logging.getLogger("nexus-rag.config")

# ============ Server Ports ============
GRPC_PORT = int(os.environ.get("GRPC_PORT", "50051"))
HTTP_PORT = int(os.environ.get("HTTP_PORT", "8000"))
GRPC_MAX_WORKERS = int(os.environ.get("GRPC_MAX_WORKERS", "10"))

# ============ Qdrant ============
QDRANT_HOST = os.environ.get("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.environ.get("QDRANT_PORT", "6333"))
QDRANT_COLLECTION = os.environ.get("QDRANT_COLLECTION", "nexus_messages")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
QDRANT_GRPC_PORT = int(os.environ.get("QDRANT_GRPC_PORT", "6334"))

# ============ Models ============
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "BAAI/bge-m3")
RERANKER_MODEL = os.environ.get("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
USE_FP16 = os.environ.get("USE_FP16", "true").lower() == "true"

# ============ Retrieval Tuning ============
DEFAULT_TOP_K = int(os.environ.get("DEFAULT_TOP_K", "5"))
RETRIEVAL_CANDIDATES = int(os.environ.get("RETRIEVAL_CANDIDATES", "50"))

# Score threshold for reranker. Set to 0.0 to disable (return all top_k).
# Architecture spec suggests 0.7 for strict relevance, but this can
# aggressively filter useful context. Tune per deployment.
RERANK_SCORE_THRESHOLD = float(os.environ.get("RERANK_SCORE_THRESHOLD", "0.0"))

# ============ Validation ============
logger.info(f"Configuration loaded:")
logger.info(f"  gRPC port:       {GRPC_PORT}")
logger.info(f"  HTTP port:       {HTTP_PORT}")
logger.info(f"  Qdrant:          {QDRANT_HOST}:{QDRANT_PORT}")
logger.info(f"  Collection:      {QDRANT_COLLECTION}")
logger.info(f"  Embedding model: {EMBEDDING_MODEL}")
logger.info(f"  Reranker model:  {RERANKER_MODEL}")
logger.info(f"  FP16:            {USE_FP16}")
logger.info(f"  Score threshold: {RERANK_SCORE_THRESHOLD}")

"""
BGE-Reranker singleton for cross-encoder scoring.
Scores query-document pairs to rerank retrieval candidates by relevance.
"""
import logging
import threading

from FlagEmbedding import FlagReranker

from app.core.config import RERANKER_MODEL, USE_FP16

logger = logging.getLogger(__name__)


class BGERerankerSingleton:
    _instance = None
    _model = None
    _lock = threading.Lock()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            with cls._lock:
                # Double-check locking pattern
                if cls._instance is None:
                    cls._instance = cls()
                    logger.info(f"Loading BGE-Reranker model: {RERANKER_MODEL} (fp16={USE_FP16})...")
                    cls._model = FlagReranker(RERANKER_MODEL, use_fp16=USE_FP16)
                    logger.info("BGE-Reranker model loaded successfully.")
        return cls._instance

    def rerank(self, query: str, contexts: list[str]) -> list[float]:
        """
        Scores contexts against the query using cross-encoder.

        Args:
            query: The search query string.
            contexts: List of candidate context strings to score.

        Returns:
            List of relevance scores (floats) corresponding to each context.
            Higher scores = more relevant.

        Raises:
            RuntimeError: If the model is not loaded.
        """
        if not contexts:
            return []

        if self._model is None:
            raise RuntimeError("BGE-Reranker model not loaded. Call get_instance() first.")

        pairs = [[query, context] for context in contexts]
        scores = self._model.compute_score(pairs)

        # FlagReranker returns a float for a single pair, list[float] for multiple.
        if isinstance(scores, (int, float)):
            return [float(scores)]
        return [float(s) for s in scores]

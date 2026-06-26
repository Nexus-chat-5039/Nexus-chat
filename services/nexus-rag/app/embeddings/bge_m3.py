"""
BGE-M3 embedding model singleton.
Produces dense (1024d) + sparse (lexical weight) vectors for hybrid retrieval.
"""
import logging
import threading

from FlagEmbedding import BGEM3FlagModel

from app.core.config import EMBEDDING_MODEL, USE_FP16

logger = logging.getLogger(__name__)


class BGEM3Singleton:
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
                    logger.info(f"Loading BGE-M3 model: {EMBEDDING_MODEL} (fp16={USE_FP16})...")
                    cls._model = BGEM3FlagModel(EMBEDDING_MODEL, use_fp16=USE_FP16)
                    logger.info("BGE-M3 model loaded successfully.")
        return cls._instance

    def embed(self, texts: list[str]):
        """
        Generates dense and sparse embeddings for the given texts.

        Args:
            texts: List of text strings to embed.

        Returns:
            Tuple of (dense_vecs, lexical_weights):
              - dense_vecs: numpy array of shape (n, 1024)
              - lexical_weights: list of dicts {str_token_id: float_weight}

        Raises:
            RuntimeError: If the model is not loaded.
            ValueError: If texts is empty.
        """
        if not texts:
            raise ValueError("Cannot embed empty text list")

        if self._model is None:
            raise RuntimeError("BGE-M3 model not loaded. Call get_instance() first.")

        embeddings = self._model.encode(
            texts,
            return_dense=True,
            return_sparse=True,
            return_colbert_vecs=False,
        )
        return embeddings["dense_vecs"], embeddings["lexical_weights"]

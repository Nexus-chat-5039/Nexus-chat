"""
Qdrant vector store client for hybrid retrieval.
Supports dense + sparse vector search with Reciprocal Rank Fusion (RRF).
"""
import logging
import uuid

from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance,
    VectorParams,
    SparseVectorParams,
    SparseVector,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    Prefetch,
    Fusion,
)

from app.core.config import QDRANT_HOST, QDRANT_PORT, QDRANT_COLLECTION, QDRANT_API_KEY

logger = logging.getLogger(__name__)


class QdrantRetriever:
    def __init__(self):
        logger.info(f"Connecting to Qdrant at {QDRANT_HOST}:{QDRANT_PORT}...")

        connect_kwargs = {"host": QDRANT_HOST, "port": QDRANT_PORT}
        if QDRANT_API_KEY:
            connect_kwargs["api_key"] = QDRANT_API_KEY
        if "cloud.qdrant.io" in QDRANT_HOST:
            connect_kwargs["https"] = True

        self.client = QdrantClient(**connect_kwargs)
        self.collection_name = QDRANT_COLLECTION
        self._ensure_collection()
        logger.info(f"Qdrant connected. Collection: {self.collection_name}")

    def _ensure_collection(self):
        """Create the collection if it doesn't exist."""
        try:
            if not self.client.collection_exists(self.collection_name):
                logger.info(f"Creating collection '{self.collection_name}' in Qdrant...")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config={
                        "dense": VectorParams(size=1024, distance=Distance.COSINE)
                    },
                    sparse_vectors_config={
                        "sparse": SparseVectorParams()
                    },
                )
                logger.info(f"Collection '{self.collection_name}' created.")
            else:
                logger.info(f"Collection '{self.collection_name}' already exists.")
        except Exception as e:
            logger.error(f"Failed to ensure collection: {e}", exc_info=True)
            raise

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_dense_list(vec) -> list[float]:
        """Convert numpy array or list to plain list of floats."""
        return vec.tolist() if hasattr(vec, "tolist") else list(vec)

    @staticmethod
    def _convert_sparse(sparse_dict: dict) -> tuple[list[int], list[float]]:
        """
        Convert BGE-M3 lexical weights dict to Qdrant sparse vector format.

        BGE-M3 format:  {"token_id_str": weight, ...}
        Qdrant format:  SparseVector(indices=[int, ...], values=[float, ...])
        """
        indices = [int(k) for k in sparse_dict.keys()]
        values = [float(v) for v in sparse_dict.values()]
        return indices, values

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def upsert_point(self, payload: dict, dense_vec, sparse_vec):
        """
        Upserts a single point (message) into Qdrant.

        Args:
            payload: Metadata dict (tenant_id, workspace_id, group_id, etc.)
            dense_vec: Dense embedding vector (numpy array or list).
            sparse_vec: Sparse lexical weights dict from BGE-M3.

        Raises:
            Exception: On Qdrant write failure.
        """
        point_id = str(uuid.uuid4())
        sparse_indices, sparse_values = self._convert_sparse(sparse_vec)

        point = PointStruct(
            id=point_id,
            vector={
                "dense": self._to_dense_list(dense_vec),
                "sparse": SparseVector(
                    indices=sparse_indices,
                    values=sparse_values,
                ),
            },
            payload=payload,
        )

        self.client.upsert(
            collection_name=self.collection_name,
            points=[point],
        )
        logger.debug(f"Upserted point {point_id} into {self.collection_name}")

    # ------------------------------------------------------------------
    # Read — Hybrid Search (Dense + Sparse with RRF)
    # ------------------------------------------------------------------

    def retrieve(
        self,
        query_dense,
        query_sparse,
        tenant_id: str,
        group_id: str,
        chat_id: str,
        workspace_id: str = "",
        top_k: int = 50,
    ):
        """
        Retrieves top_k candidates using hybrid search (dense + sparse RRF).

        Falls back to dense-only search if hybrid fails (e.g., older Qdrant version).

        Args:
            query_dense: Dense query embedding (numpy array or list).
            query_sparse: Sparse lexical weights dict from BGE-M3.
            tenant_id: Tenant ID for multi-tenant isolation.
            group_id: Group scope for filtering.
            chat_id: Chat scope for filtering.
            workspace_id: Optional workspace scope for filtering.
            top_k: Number of candidates to retrieve.

        Returns:
            List of ScoredPoint objects with payloads.
        """
        # Build filter conditions
        filter_conditions = [
            FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id)),
            FieldCondition(key="group_id", match=MatchValue(value=group_id)),
            FieldCondition(key="chat_id", match=MatchValue(value=chat_id)),
        ]
        if workspace_id:
            filter_conditions.append(
                FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id))
            )

        query_filter = Filter(must=filter_conditions)
        dense_list = self._to_dense_list(query_dense)
        sparse_indices, sparse_values = self._convert_sparse(query_sparse)

        # --- Attempt hybrid search with RRF fusion ---
        try:
            results = self.client.query_points(
                collection_name=self.collection_name,
                prefetch=[
                    Prefetch(
                        query=dense_list,
                        using="dense",
                        limit=top_k,
                    ),
                    Prefetch(
                        query=SparseVector(
                            indices=sparse_indices,
                            values=sparse_values,
                        ),
                        using="sparse",
                        limit=top_k,
                    ),
                ],
                query=Fusion.RRF,
                query_filter=query_filter,
                limit=top_k,
                with_payload=True,
            )
            logger.debug(f"Hybrid search returned {len(results.points)} candidates")
            return results.points

        except Exception as e:
            logger.warning(f"Hybrid search failed, falling back to dense-only: {e}")

        # --- Fallback: dense-only search ---
        try:
            search_result = self.client.search(
                collection_name=self.collection_name,
                query_vector=("dense", dense_list),
                query_filter=query_filter,
                limit=top_k,
                with_payload=True,
            )
            logger.debug(f"Dense-only search returned {len(search_result)} candidates")
            return search_result

        except Exception as e:
            logger.error(f"Dense-only search also failed: {e}", exc_info=True)
            raise

    # ------------------------------------------------------------------
    # Health Check
    # ------------------------------------------------------------------

    def health_check(self) -> bool:
        """Check Qdrant connectivity and collection availability."""
        try:
            info = self.client.get_collection(self.collection_name)
            return info.status.value == "green"
        except Exception as e:
            logger.warning(f"Qdrant health check failed: {e}")
            return False

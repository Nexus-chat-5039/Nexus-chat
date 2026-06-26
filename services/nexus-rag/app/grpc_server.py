"""
gRPC service implementation for nexus-rag.
Implements RAGService: RetrieveContext and EmbedAndStore RPCs.
"""
import logging

import grpc

import sys
import os

# Add proto generated paths
sys.path.append(os.path.join(os.path.dirname(__file__), "../proto_out"))

import rag_pb2
import rag_pb2_grpc

from app.embeddings.bge_m3 import BGEM3Singleton
from app.reranker.bge_reranker import BGERerankerSingleton
from app.retriever.qdrant import QdrantRetriever
from app.core.config import DEFAULT_TOP_K, RETRIEVAL_CANDIDATES, RERANK_SCORE_THRESHOLD

logger = logging.getLogger(__name__)


class RAGServiceServicer(rag_pb2_grpc.RAGServiceServicer):
    def __init__(self):
        logger.info("Initializing RAGServiceServicer...")
        self.bge_m3 = BGEM3Singleton.get_instance()
        self.reranker = BGERerankerSingleton.get_instance()
        self.qdrant = QdrantRetriever()
        logger.info("RAGServiceServicer initialized successfully.")

    def RetrieveContext(self, request, context):
        """
        Full retrieval pipeline:
        1. Validate input
        2. Embed query (BGE-M3 dense + sparse)
        3. Retrieve candidates from Qdrant (hybrid search)
        4. Rerank candidates (BGE-Reranker cross-encoder)
        5. Apply score threshold + select top_k
        6. Return scored context chunks
        """
        try:
            # --- Validate request ---
            if not request.query:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("query cannot be empty")
                return rag_pb2.RetrieveResponse()

            if not request.tenant_id:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("tenant_id is required")
                return rag_pb2.RetrieveResponse()

            if not request.group_id or not request.chat_id:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("group_id and chat_id are required")
                return rag_pb2.RetrieveResponse()

            logger.info(
                f"RetrieveContext: query='{request.query[:60]}...' "
                f"tenant={request.tenant_id} group={request.group_id} chat={request.chat_id}"
            )

            # --- 1. Embed query ---
            try:
                dense_vecs, sparse_vecs = self.bge_m3.embed([request.query])
            except Exception as e:
                logger.error(f"Embedding failed: {e}", exc_info=True)
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details(f"Embedding model error: {e}")
                return rag_pb2.RetrieveResponse()

            query_dense = dense_vecs[0]
            query_sparse = sparse_vecs[0]

            # --- 2. Retrieve candidates from Qdrant (hybrid: dense + sparse RRF) ---
            try:
                search_results = self.qdrant.retrieve(
                    query_dense=query_dense,
                    query_sparse=query_sparse,
                    tenant_id=request.tenant_id,
                    group_id=request.group_id,
                    chat_id=request.chat_id,
                    workspace_id=request.workspace_id,
                    top_k=RETRIEVAL_CANDIDATES,
                )
            except Exception as e:
                logger.error(f"Qdrant retrieval failed: {e}", exc_info=True)
                context.set_code(grpc.StatusCode.UNAVAILABLE)
                context.set_details(f"Vector store unavailable: {e}")
                return rag_pb2.RetrieveResponse()

            # Extract content and metadata from results
            candidates = []
            source_users = []
            for res in search_results:
                payload = getattr(res, "payload", None) or {}
                content = payload.get("content", "")
                if content:
                    candidates.append(content)
                    source_users.append(payload.get("user_id", ""))

            if not candidates:
                logger.info("No candidates found in vector store.")
                return rag_pb2.RetrieveResponse(chunks=[], total_tokens=0)

            logger.debug(f"Retrieved {len(candidates)} candidates from Qdrant")

            # --- 3. Rerank candidates ---
            try:
                scores = self.reranker.rerank(request.query, candidates)
            except Exception as e:
                logger.error(f"Reranking failed: {e}", exc_info=True)
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details(f"Reranker model error: {e}")
                return rag_pb2.RetrieveResponse()

            # --- 4. Score threshold + select top_k ---
            scored_candidates = list(zip(scores, candidates, source_users))
            scored_candidates.sort(key=lambda x: x[0], reverse=True)

            top_k = request.top_k if request.top_k > 0 else DEFAULT_TOP_K

            # Apply score threshold if configured
            if RERANK_SCORE_THRESHOLD > 0.0:
                scored_candidates = [
                    (s, c, u) for s, c, u in scored_candidates
                    if s >= RERANK_SCORE_THRESHOLD
                ]

            selected = scored_candidates[:top_k]

            # --- 5. Build response ---
            response_chunks = []
            total_tokens = 0

            for score, content, user_id in selected:
                chunk = rag_pb2.ContextChunk(
                    content=content,
                    score=score,
                    source_user_id=user_id,
                )
                response_chunks.append(chunk)
                # Token estimation: ~4 chars per token (more accurate than word-based)
                total_tokens += max(1, len(content) // 4)

            logger.info(
                f"RetrieveContext complete: {len(response_chunks)} chunks, "
                f"~{total_tokens} tokens"
            )

            return rag_pb2.RetrieveResponse(
                chunks=response_chunks,
                total_tokens=total_tokens,
            )

        except Exception as e:
            logger.error(f"RetrieveContext unexpected error: {e}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Unexpected error: {e}")
            return rag_pb2.RetrieveResponse()

    def EmbedAndStore(self, request, context):
        """
        Embeds content and stores it in Qdrant with full metadata.
        Called asynchronously via Pub/Sub after a message is sent.
        """
        try:
            # --- Validate request ---
            if not request.content:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("content cannot be empty")
                return rag_pb2.EmbedResponse(
                    success=False, message="content cannot be empty"
                )

            if not request.tenant_id:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("tenant_id is required")
                return rag_pb2.EmbedResponse(
                    success=False, message="tenant_id is required"
                )

            logger.info(
                f"EmbedAndStore: content='{request.content[:50]}...' "
                f"tenant={request.tenant_id} user={request.user_id}"
            )

            # --- Embed ---
            try:
                dense_vecs, sparse_vecs = self.bge_m3.embed([request.content])
            except Exception as e:
                logger.error(f"Embedding failed: {e}", exc_info=True)
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details(f"Embedding model error: {e}")
                return rag_pb2.EmbedResponse(
                    success=False, message=f"Embedding failed: {e}"
                )

            # --- Store in Qdrant ---
            payload = {
                "tenant_id": request.tenant_id,
                "workspace_id": request.workspace_id,
                "group_id": request.group_id,
                "chat_id": request.chat_id,
                "user_id": request.user_id,
                "role": request.role,
                "content": request.content,
                "created_at": request.created_at,
            }

            try:
                self.qdrant.upsert_point(
                    payload=payload,
                    dense_vec=dense_vecs[0],
                    sparse_vec=sparse_vecs[0],
                )
            except Exception as e:
                logger.error(f"Qdrant upsert failed: {e}", exc_info=True)
                context.set_code(grpc.StatusCode.UNAVAILABLE)
                context.set_details(f"Vector store write failed: {e}")
                return rag_pb2.EmbedResponse(
                    success=False, message=f"Storage failed: {e}"
                )

            logger.info("EmbedAndStore completed successfully.")
            return rag_pb2.EmbedResponse(
                success=True,
                message="Successfully embedded and stored",
            )

        except Exception as e:
            logger.error(f"EmbedAndStore unexpected error: {e}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Unexpected error: {e}")
            return rag_pb2.EmbedResponse(
                success=False, message=f"Unexpected error: {e}"
            )

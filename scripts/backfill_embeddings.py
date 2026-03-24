#!/usr/bin/env python3
"""Backfill vector embeddings for existing messages (moved from nexus-rag/backfill_embeddings.py).

Run from the nexus-rag/ directory:
    cd nexus-rag && python ../scripts/backfill_embeddings.py
"""

import asyncio
import os
from dotenv import load_dotenv
from pymongo import MongoClient
import certifi

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    print("MONGO_URI not found in environment")
    exit(1)

try:
    from app.embeddings.embedder import embed_text
except ImportError:
    print("ERROR: Run this script from the nexus-rag/ directory:")
    print("  cd nexus-rag && python ../scripts/backfill_embeddings.py")
    exit(1)


async def backfill():
    print("Starting backfill...")
    client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db = client["nexus"]
    msg_col = db["messages"]
    vec_col = db["memory_vectors"]

    cursor = msg_col.find({})
    count = 0

    for msg in cursor:
        try:
            user = msg.get("user_id", "unknown")
            content = msg.get("content", "")
            group_id = msg.get("group_id")
            chat_id = msg.get("chat_id")

            if not content:
                continue

            vector_content = f"User ({user}): {content}"
            embedding = embed_text(vector_content)

            vec_col.insert_one({
                "group_id": group_id,
                "chat_id": chat_id,
                "content": vector_content,
                "embedding": embedding,
                "created_at": msg.get("created_at"),
                "metadata": {"user_id": user, "type": "chat_message", "original_msg_id": msg["_id"]}
            })
            count += 1
            if count % 10 == 0:
                print(f"Processed {count} messages...")
        except Exception as e:
            print(f"Skipping msg {msg.get('_id')}: {e}")

    print(f"Backfill complete! Processed {count} messages.")


if __name__ == "__main__":
    asyncio.run(backfill())

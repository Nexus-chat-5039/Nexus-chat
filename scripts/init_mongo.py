#!/usr/bin/env python3
"""Debug retrieval test — standalone version (moved from nexus-rag/init_mongo.py)."""

from pymongo import MongoClient
import certifi
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    print("MONGO_URI not found in environment")
    exit(1)

client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client["nexus"]
collection = db["memory_vectors"]

print("Generating embedding for query 'age of rajat'...")

# NOTE: This script originally imported from app.embeddings.embedder.
# Run from the nexus-rag/ directory if you need the app imports:
#   cd nexus-rag && python -m scripts.init_mongo
# Or install sentence-transformers and adapt as needed.
try:
    from app.embeddings.embedder import Embedder
except ImportError:
    print("ERROR: Run this script from the nexus-rag/ directory:")
    print("  cd nexus-rag && python ../scripts/init_mongo.py")
    exit(1)

embedder = Embedder()
query_embedding = embedder.embed("age of rajat")
print(f"✅ Embedding generated. Dimensions: {len(query_embedding)}")

pipeline = [
    {
        "$vectorSearch": {
            "index": "vector_index",
            "path": "embedding",
            "queryVector": query_embedding,
            "numCandidates": 100,
            "limit": 3,
            "filter": {
                "room_id": "auth"
            }
        }
    },
    {
        "$project": {
            "_id": 0,
            "text": 1,
            "score": {"$meta": "vectorSearchScore"}
        }
    }
]

print("\nRunning Vector Search...")
try:
    results = list(collection.aggregate(pipeline))
    if results:
        print("✅ SUCCESS! Found documents:")
        for r in results:
            print(f"- {r['text']} (Score: {r.get('score')})")
    else:
        print("❌ FAILED. Zero results found.")
        print("Possible causes:")
        print(f"1. Index name 'vector_index' is wrong in Atlas.")
        print(f"2. Atlas Index dimensions do NOT match {len(query_embedding)}.")
        print(f"3. Index is still building.")

except Exception as e:
    print(f"❌ CRASHED: {e}")

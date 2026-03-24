#!/usr/bin/env python3
"""Inspect DB — show message counts by group_id (moved from nexus-rag/inspect_db.py)."""

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
col = db["messages"]

pipeline = [
    {"$group": {"_id": "$group_id", "count": {"$sum": 1}}}
]
for doc in col.aggregate(pipeline):
    print(f"Group: {doc['_id']} | Count: {doc['count']}")

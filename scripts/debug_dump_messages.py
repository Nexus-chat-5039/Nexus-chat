#!/usr/bin/env python3
"""Dump recent messages from the DB for debugging (moved from nexus-rag/debug_dump_messages.py)."""

from pymongo import MongoClient
import certifi
import os
import pprint
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    print("MONGO_URI not found in environment")
    exit(1)

client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client["nexus"]
col = db["messages"]

# Get last 50 messages
cursor = col.find().sort("created_at", -1).limit(50)

print(f"Total messages found: {col.count_documents({})}")
for msg in cursor:
    print("----------------")
    pprint.pprint(msg)

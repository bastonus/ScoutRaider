"""
Offline-First Cache Layer for ScoutRaider Connectors.
Provides in-memory and disk persistence for queries (POIs, weather, heritage)
to enable operation in isolated environments (camps, forest, offline).
"""

import time
import json
import hashlib
from pathlib import Path
from typing import Dict, Any, Optional
import structlog

logger = structlog.get_logger()

CACHE_DIR = Path(".cache/connectors")


class ConnectorCache:
    def __init__(self, ttl_seconds: int = 86400):  # 24h default TTL
        self.ttl = ttl_seconds
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def _hash_key(self, connector_id: str, query: Dict[str, Any]) -> str:
        serialized = json.dumps({"cid": connector_id, "q": query}, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def get(self, connector_id: str, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        key = self._hash_key(connector_id, query)
        now = time.time()

        # 1. Check memory
        if key in self._memory_cache:
            entry = self._memory_cache[key]
            if now - entry["timestamp"] < self.ttl:
                return entry["data"]

        # 2. Check disk cache
        cache_file = CACHE_DIR / f"{connector_id}_{key}.json"
        if cache_file.exists():
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    entry = json.load(f)
                    if now - entry["timestamp"] < self.ttl:
                        self._memory_cache[key] = entry
                        return entry["data"]
            except Exception as e:
                logger.warning("connector_cache_read_error", error=str(e))

        return None

    def set(self, connector_id: str, query: Dict[str, Any], data: Dict[str, Any]):
        key = self._hash_key(connector_id, query)
        entry = {
            "timestamp": time.time(),
            "connector_id": connector_id,
            "data": data
        }
        self._memory_cache[key] = entry

        # Save to disk asynchronously/safely
        cache_file = CACHE_DIR / f"{connector_id}_{key}.json"
        try:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(entry, f, ensure_ascii=False)
        except Exception as e:
            logger.warning("connector_cache_write_error", error=str(e))


connector_cache = ConnectorCache()

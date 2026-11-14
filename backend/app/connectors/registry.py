"""
Registry of Connectors for ScoutRaider.
Discovers, instantiates and manages connectors lifecycle.
"""

from typing import Dict, List, Optional
from .base import BaseConnector, ConnectorMetadata
from .osm import OSMConnector


class ConnectorRegistry:
    def __init__(self):
        self._connectors: Dict[str, BaseConnector] = {}
        # Register builtin connectors
        self.register(OSMConnector())

    def register(self, connector: BaseConnector):
        self._connectors[connector.metadata.id] = connector

    def get(self, connector_id: str) -> Optional[BaseConnector]:
        return self._connectors.get(connector_id)

    def list_all(self) -> List[ConnectorMetadata]:
        return [c.metadata for c in self._connectors.values()]


connector_registry = ConnectorRegistry()

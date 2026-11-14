"""
Base Interface for ScoutRaider Connectors.
A connector provides external spatial, environmental, cultural or meteorological data
to enhance the raid creation and the AI Assistant context.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from pydantic import BaseModel


class ConnectorMetadata(BaseModel):
    id: str
    name: str
    description: str
    category: str  # 'geo', 'heritage', 'weather', 'scout'
    requires_api_key: bool = False
    is_enabled: bool = True
    website: Optional[str] = None


class BaseConnector(ABC):
    """Abstract class for all external connectors."""

    @property
    @abstractmethod
    def metadata(self) -> ConnectorMetadata:
        """Returns metadata about the connector."""
        pass

    @abstractmethod
    async def test_connection(self) -> bool:
        """Checks whether the external service is reachable."""
        pass

    @abstractmethod
    async def fetch(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """Main method to query data from this connector."""
        pass

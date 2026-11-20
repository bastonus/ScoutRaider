# connectors

## Overview
External service connectors interfacing with third-party cartography, geocoding, and storage.

## Interface
- `[base.py] class ConnectorMetadata`
- `[base.py] class BaseConnector`
- `[base.py]   BaseConnector.metadata()`
- `[base.py]   BaseConnector.test_connection()`
- `[base.py]   BaseConnector.fetch()`
- `[osm.py] class OSMConnector`
- `[osm.py]   OSMConnector.metadata()`
- `[osm.py]   OSMConnector.test_connection()`
- `[osm.py]   OSMConnector.fetch()`
- `[registry.py] class ConnectorRegistry`
- `[registry.py]   ConnectorRegistry.__init__()`
- `[registry.py]   ConnectorRegistry.register()`
- `[registry.py]   ConnectorRegistry.get()`
- `[registry.py]   ConnectorRegistry.list_all()`

## Invariants
- None

## Side Effects
- Network / HTTP / S3 external requests

## Verification
- Run: `pytest tests/ -v`

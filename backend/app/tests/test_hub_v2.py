"""
test_hub_v2.py — Verification tests for ScoutRaider Hub v2.0 Standard,
Capabilities (spatial, altimetry, synoptic map), Dependencies Graph, and MCP Hub Tools.
"""

import pytest
from pathlib import Path
from app.modules.schema import (
    HubResourceType,
    DataCapability,
    HubResourceMetadata,
    TrameDependencies,
    ResourceDependency,
    CustomMapConfig,
    TileProtocol,
    DiffractionConstraints
)
from app.modules.registry import ModuleRegistry
from app.mcp.server import ScoutRaiderMCPServer

LEGACY_MODULES_DIR = Path(__file__).resolve().parents[3] / "legacy" / "modules"


def test_hub_v2_schema_validation():
    """Verify that HubResourceMetadata validates v2 manifests strictly."""
    # 1. Spatial / Gilwell
    gilwell_meta = HubResourceMetadata(
        id="gilwell",
        name="Relevé Gilwell Studio",
        version="2.0.0",
        resource_type=HubResourceType.CRYPTO_MODULE,
        data_capability=DataCapability.MAP_PATH,
        description="Relevé de route d'azimuts et métrages",
        render_type="svg",
        entrypoint="logic/GilwellEngine.ts"
    )
    assert gilwell_meta.data_capability == DataCapability.MAP_PATH
    assert gilwell_meta.resource_type == HubResourceType.CRYPTO_MODULE

    # 2. Elevation profile module
    elevation_meta = HubResourceMetadata(
        id="profil_altimetrique",
        name="Profil Altimétrique & Dénivelé",
        version="2.0.0",
        resource_type=HubResourceType.CRYPTO_MODULE,
        data_capability=DataCapability.ELEVATION_PROFILE,
        description="Génération du profil de relief, pentes et dénivelés D+/D-",
        render_type="svg"
    )
    assert elevation_meta.data_capability == DataCapability.ELEVATION_PROFILE

    # 3. Synoptic map overview module
    overview_meta = HubResourceMetadata(
        id="apercu_synoptique",
        name="Aperçu Général de la Carte",
        version="2.0.0",
        resource_type=HubResourceType.CRYPTO_MODULE,
        data_capability=DataCapability.MAP_OVERVIEW,
        description="Vue d'ensemble cartographique globale du raid avec jalons",
        render_type="map"
    )
    assert overview_meta.data_capability == DataCapability.MAP_OVERVIEW


def test_custom_map_config():
    """Test custom map tile provider schema."""
    custom_map = CustomMapConfig(
        tile_type=TileProtocol.XYZ,
        tile_url="https://tiles.scout.org/{z}/{x}/{y}.png",
        min_zoom=5,
        max_zoom=18,
        attribution="© OpenTopoMap Scout",
        requires_auth=True,
        auth_token="secret_token_123"
    )
    assert custom_map.tile_type == TileProtocol.XYZ
    assert "{z}" in custom_map.tile_url
    assert custom_map.requires_auth is True


def test_trame_dependencies_resolution():
    """Test dependency graph evaluation for Trames de Raid."""
    registry = ModuleRegistry()
    registry.load_from_base_dir(LEGACY_MODULES_DIR)

    # Declare a Trame with dependencies
    deps = TrameDependencies(
        required_modules=[
            ResourceDependency(id="morse", version_req=">=1.0.0", role="transmission"),
            ResourceDependency(id="gilwell", version_req=">=1.0.0", role="croquis_azimut"),
            ResourceDependency(id="module_exotique_non_installe", version_req="^1.0.0", role="bonus", optional=False)
        ],
        recommended_map="PLAN.IGN",
        default_theme="chemins_epiques"
    )

    res = registry.resolve_trame_dependencies("trame_test", deps)

    assert res["status"] == "requires_resolution"
    satisfied_ids = {s["id"] for s in res["satisfied"]}
    assert "morse" in satisfied_ids
    assert "gilwell" in satisfied_ids

    to_download_ids = {d["id"] for d in res["to_download"]}
    assert "module_exotique_non_installe" in to_download_ids


def test_registry_list_by_capability():
    """Test capability filtering in ModuleRegistry."""
    registry = ModuleRegistry()
    registry.load_from_base_dir(LEGACY_MODULES_DIR)

    # Check that spatial map_path returns gilwell
    map_paths = registry.list_by_capability(DataCapability.MAP_PATH)
    assert any(m.id == "gilwell" for m in map_paths)

    # Check alphabetic returns morse / avocat
    alphabetic = registry.list_by_capability(DataCapability.ALPHABETIC)
    assert any(m.id == "morse" for m in alphabetic)


def test_mcp_hub_tools():
    """Verify MCP Hub tools."""
    registry = ModuleRegistry()
    registry.load_from_base_dir(LEGACY_MODULES_DIR)
    server = ScoutRaiderMCPServer(module_registry=registry)

    # 1. Query catalog
    cat = server._execute_tool("scout_hub_query_catalog", {"capability": "map_path"})
    assert isinstance(cat, list)
    assert any(item["id"] == "gilwell" for item in cat)

    # 2. Get manifest
    manifest = server._execute_tool("scout_hub_get_manifest", {"resource_id": "morse"})
    assert manifest["id"] == "morse"

    # 3. Validate manifest
    valid_diag = server._execute_tool("scout_hub_validate_manifest", {
        "manifest_data": {
            "id": "mon_code",
            "name": "Mon Nouveau Code",
            "resource_type": "crypto_module",
            "data_capability": "alphabetic"
        }
    })
    assert valid_diag["valid"] is True

    # 4. Generate template
    tmpl = server._execute_tool("scout_hub_generate_template", {
        "module_id": "code_braille",
        "data_capability": "alphabetic"
    })
    assert tmpl["module_id"] == "code_braille"
    assert "manifest.json" in tmpl


def test_routing_engine_and_path_provider_modules():
    """Verify that routing_engine and path_provider modules validate properly."""
    from app.modules.schema import RoutingEngineConfig, PathProviderConfig

    # 1. Routing Engine
    brouter = HubResourceMetadata(
        id="routing_brouter",
        name="Moteur BRouter Randonnée",
        version="2.0.0",
        resource_type=HubResourceType.ROUTING_ENGINE,
        description="Calcul d'itinéraires pédestres et de randonnée",
        routing_config=RoutingEngineConfig(
            supported_profiles=["hiking", "trekking", "pedestrian"],
            default_profile="hiking",
            elevation_support=True
        )
    )
    assert brouter.resource_type == HubResourceType.ROUTING_ENGINE
    assert brouter.routing_config.default_profile == "hiking"
    assert "trekking" in brouter.routing_config.supported_profiles

    # 2. Path Provider
    gpx_loader = HubResourceMetadata(
        id="loader_gpx",
        name="Chargeur GPX Universel",
        version="2.0.0",
        resource_type=HubResourceType.PATH_PROVIDER,
        description="Importateur et analyseur de traces GPX",
        path_provider_config=PathProviderConfig(
            supported_formats=["gpx", "xml"],
            extracts_elevation=True,
            extracts_waypoints=True
        )
    )
    assert gpx_loader.resource_type == HubResourceType.PATH_PROVIDER
    assert "gpx" in gpx_loader.path_provider_config.supported_formats
    assert gpx_loader.path_provider_config.extracts_elevation is True


@pytest.mark.asyncio
async def test_s3_module_storage_and_catalog(monkeypatch):
    """Verify Garage S3 module URL formatting, upload, download, and catalog index retrieval."""
    from app.services.s3_client import garage_client
    from app.config import settings
    from unittest.mock import MagicMock

    # 1. URL formatting
    s3_url = garage_client.get_module_url("morse", "2.0.0")
    expected_url = f"{garage_client.public_url}/{garage_client.bucket}/modules/morse-2.0.0.zip"
    assert s3_url == expected_url

    # 2. Upload test package (mocked S3 put_object)
    mock_s3 = MagicMock()
    mock_s3.put_object.return_value = {"ResponseMetadata": {"HTTPStatusCode": 200}}
    mock_s3.get_object.return_value = {"Body": MagicMock(read=lambda: b"PK\x05\x06" + b"\x00" * 18)}
    mock_s3.delete_object.return_value = {"ResponseMetadata": {"HTTPStatusCode": 204}}

    monkeypatch.setattr(garage_client, "s3", mock_s3)

    test_zip_content = b"PK\x05\x06" + b"\x00" * 18  # Empty zip header
    uploaded_url = await garage_client.upload_module_package(
        module_id="test_unit_mod",
        version="1.0.0",
        data=test_zip_content
    )
    assert "test_unit_mod-1.0.0.zip" in uploaded_url
    assert mock_s3.put_object.called

    # 3. Download back
    downloaded = await garage_client.download_module_package("test_unit_mod", "1.0.0")
    assert downloaded == test_zip_content
    assert mock_s3.get_object.called

    # 4. Clean up test package
    deleted = await garage_client.delete_asset("test_unit_mod-1.0.0.zip", asset_type="module")
    assert deleted is True
    assert mock_s3.delete_object.called


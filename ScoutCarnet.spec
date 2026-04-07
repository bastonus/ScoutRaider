# -*- mode: python ; coding: utf-8 -*-
"""
ScoutCarnet.spec — PyInstaller build specification for ScoutRaider Suite.
Run with: pyinstaller ScoutCarnet.spec --noconfirm
Or use:    python build.py
"""
import os

block_cipher = None

# ── Data files to bundle ──────────────────────────────────
datas = [
    ('config', 'config'),
    ('modules', 'modules'),
    ('utils', 'utils'),
    ('ui/workspace/map_template.html', 'ui/workspace'),
    ('ui/workspace/leaflet.js', 'ui/workspace'),
    ('ui/workspace/leaflet.css', 'ui/workspace'),
    ('ui/workspace/GpPluginLeaflet.js', 'ui/workspace'),
    ('ui/workspace/GpPluginLeaflet.css', 'ui/workspace'),
    ('ui/workspace/style.qss', 'ui/workspace'),
    ('ui/workspace/proj4.js', 'ui/workspace'),
    ('assets', 'assets'),
    ('refactor_polygonalisation.py', '.'),
    ('version.py', '.'),
]

# ── Hidden imports ────────────────────────────────────────
hiddenimports = [
    'PySide6.QtWebEngineCore',
    'PySide6.QtWebEngineWidgets',
    'PySide6.QtWebChannel',
    'folium',
    'reportlab',
    'reportlab.lib.pagesizes',
    'reportlab.pdfgen.canvas',
    'reportlab.platypus',
    'geopy',
    'requests',
    'shapely',
    'numpy',
    'matplotlib',
    'geographiclib',
    'ui.workspace.help_dialog',
    'ui.workspace.map_view',
    'ui.workspace.route_panel',
    'ui.workspace.tools_panel',
    'ui.workspace.library_dock',
    'ui.workspace.difficulty_panel',
    'utils.background_engine',
    'utils.ign_client',
    'utils.pdf_helpers',
    'utils.presets_manager',
    'utils.route_engine',
    'utils.validation_helpers',
    'state_manager',
    'main_orchestrator',
    'refactor_polygonalisation',
]

# Automatically discover game modules
for m in os.listdir('modules'):
    mod_path = os.path.join('modules', m)
    if os.path.isdir(mod_path) and os.path.exists(os.path.join(mod_path, 'module.py')):
        hiddenimports.append(f'modules.{m}.module')

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='ScoutCarnet',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='NONE',  # TODO: Replace with app icon path (e.g., 'assets/icon.ico')
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='ScoutCarnet',
)

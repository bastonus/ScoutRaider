// ── Map Configuration & Metadata ──────────────────────────────────────────────

export const PROVIDERS = {
    'IGN': {
        name: 'IGN France',
        logo: './assets/IGN_logo.svg',
        preview: './assets/preview_plan_ign.png',
        description: "L'Institut National de l'Information Géographique et Forestière est la référence pour la cartographie française (Scan 25, Cassini, Orthophotos).",
        website: 'https://www.ign.fr'
    },
    'Mapy.cz': {
        name: 'Mapy.cz (Seznam)',
        logo: './assets/logo_mapy_white.svg',
        preview: 'https://napoveda.seznam.cz/wp-content/uploads/2021/04/turisticka.png',
        description: "Service cartographique de Seznam.cz, offrant les meilleures cartes outdoor et sentiers de randonnée en Europe.",
        website: 'https://mapy.cz'
    },
    'OSM': {
        name: 'OpenStreetMap',
        logo: './assets/logo_osm_white.svg',
        preview: './assets/preview_osm.png',
        description: "Projet de cartographie collaborative mondiale. Gratuit, libre et constamment mis à jour par la communauté.",
        website: 'https://www.openstreetmap.org'
    }
};

export const MAP_LAYERS: Record<string, { url: string, attribution: string, maxZoom: number, category: string, provider: keyof typeof PROVIDERS, needsKey?: boolean, preview?: string, isFavorite?: boolean, isSatellite?: boolean }> = {
    // ── IGN (Public) ─────────────────────────────────────────────────────────
    'PLAN.IGN': {
        url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
        attribution: '© IGN',
        maxZoom: 19, category: 'IGN', provider: 'IGN', needsKey: false,
        preview: './assets/preview_plan_ign.png'
    },
    'SAT.IGN': {
        url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
        attribution: '© IGN',
        maxZoom: 19, category: 'IGN', provider: 'IGN', needsKey: false,
        preview: './assets/preview_sat_ign.jpg',
        isSatellite: true
    },
    'CADASTRE': {
        url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
        attribution: '© IGN (Cadastre)',
        maxZoom: 19, category: 'IGN', provider: 'IGN', needsKey: false,
        preview: './assets/preview_cadastre.png'
    },
    'PENTES': {
        url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=ELEVATION.SLOPES&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
        attribution: '© IGN (Pentes)',
        maxZoom: 19, category: 'IGN', provider: 'IGN', needsKey: false,
        preview: './assets/preview_pentes.jpg'
    },

    // ── IGN (Privé - Community) ─────────────────────────────────────────────
    'SCAN_EXPRESS': {
        url: 'https://data.geopf.fr/private/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-EXPRESS.CLASSIQUE&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&apikey={key}',
        attribution: '© IGN (Scan Express)',
        maxZoom: 18, category: 'IGN (Privé)', provider: 'IGN', needsKey: true,
        preview: './assets/ign_scan25_preview.png'
    },

    // ── IGN (Privé - Community) ─────────────────────────────────────────────
    'SCAN25': {
        url: 'https://data.geopf.fr/private/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&apikey={key}',
        attribution: '© IGN (Scan 25/100)',
        maxZoom: 18, category: 'IGN (Privé)', provider: 'IGN', needsKey: true,
        preview: './assets/ign_scan25_preview.png',
        isFavorite: true
    },
    'CASSINI': {
        url: 'https://data.geopf.fr/private/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.CASSINI&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&apikey={key}',
        attribution: '© IGN (Cassini)',
        maxZoom: 15, category: 'IGN (Privé)', provider: 'IGN', needsKey: true,
        preview: './assets/ign_cassini_preview.jpg'
    },
    'SCAN50_1950': {
        url: 'https://data.geopf.fr/private/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.1950SCAN50&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&apikey={key}',
        attribution: '© IGN (Scan 50 - 1950)',
        maxZoom: 16, category: 'IGN (Privé)', provider: 'IGN', needsKey: true,
        preview: './assets/vignette_scan50_1950.jpg'
    },

    // ── OpenStreetMap ────────────────────────────────────────────────────────
    'OSM': {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OSM',
        maxZoom: 19, category: 'OpenStreetMap', provider: 'OSM', needsKey: false,
        preview: './assets/preview_osm.png'
    },
    'CYCLOSM': {
        url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
        attribution: '© CyclOSM | OSM',
        maxZoom: 19, category: 'OpenStreetMap', provider: 'OSM', needsKey: false,
        preview: './assets/preview_cyclosm.png'
    },
    'OPENTOPOMAP': {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: '© OpenTopoMap | OSM',
        maxZoom: 17, category: 'OpenStreetMap', provider: 'OSM', needsKey: false,
        preview: './assets/preview_opentopomap.png'
    },

    // ── Mapy.cz ──────────────────────────────────────────────────────────────
    'MAPY_OUTDOOR': {
        url: 'https://api.mapy.cz/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey={key}',
        attribution: '© Mapy.cz | OSM',
        maxZoom: 19, category: 'Mapy.cz', provider: 'Mapy.cz', needsKey: true,
        preview: './assets/vignette_mapy_outdoor.png',
        isFavorite: true
    },
    'MAPY_WINTER': {
        url: 'https://api.mapy.cz/v1/maptiles/winter/256/{z}/{x}/{y}?apikey={key}',
        attribution: '© Mapy.cz | OSM',
        maxZoom: 19, category: 'Mapy.cz', provider: 'Mapy.cz', needsKey: true,
        preview: './assets/vignette_mapy_winter.png'
    },
    'MAPY_SAT': {
        url: 'https://api.mapy.cz/v1/maptiles/aerial/256/{z}/{x}/{y}?apikey={key}',
        attribution: '© Mapy.cz',
        maxZoom: 19, category: 'Mapy.cz', provider: 'Mapy.cz', needsKey: true,
        preview: './assets/vignette_mapy_sat.jpg',
        isSatellite: true
    },
    'MAPY_BASIC': {
        url: 'https://api.mapy.cz/v1/maptiles/basic/256/{z}/{x}/{y}?apikey={key}',
        attribution: '© Mapy.cz | OSM',
        maxZoom: 19, category: 'Mapy.cz', provider: 'Mapy.cz', needsKey: true,
        preview: './assets/vignette_mapy_basic.png',
        isFavorite: true
    }
};

/**
 * ScoutRaider Modules Hub — Central Registry of Standardized Modules (v2.0)
 */

// Cryptography & Topography Modules
export { default as morseModule } from './morse';
export { default as vigenereModule } from './vigenere';
export { default as polybeModule } from './polybe';
export { default as templierModule } from './templier';
export { default as avocatModule } from './avocat';
export { default as cassisModule } from './cassis';
export { default as maritimeModule } from './maritime';
export { default as elevationModule } from './profil_altimetrique';
export { default as mapOverviewModule } from './apercu_carte';
export * from './gilwell';

// Routing Engines (Moteurs de calcul de tracés)
export { default as routingBrouterModule } from './routing_brouter';
export { default as routingValhallaIgnModule } from './routing_valhalla_ign';
export { default as routingDirectModule } from './routing_direct';

// Path Loaders & Providers (Chargeurs & Connecteurs de chemins)
export { default as loaderGpxModule } from './loader_gpx';
export { default as loaderGeojsonModule } from './loader_geojson';

// Types
export * from './routing_types';

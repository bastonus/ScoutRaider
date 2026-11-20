/**
 * Map Overview Module — Standard v2.0
 */

export interface MapOverviewConfig {
  show_north_arrow?: boolean;
  show_scale?: boolean;
  emergency_contacts?: string[];
}

export function generateSynopticCartouche(title: string, config: MapOverviewConfig = {}) {
  return {
    title,
    has_north_arrow: config.show_north_arrow ?? true,
    has_scale: config.show_scale ?? true,
    emergency_box: config.emergency_contacts || ['112 (Urgences Europe)', '15 (SAMU)']
  };
}

export default {
  id: 'apercu_carte',
  name: 'Aperçu Synoptique de Carte',
  capability: 'map_overview',
  transform: (title: string, config?: MapOverviewConfig) => generateSynopticCartouche(title, config)
};

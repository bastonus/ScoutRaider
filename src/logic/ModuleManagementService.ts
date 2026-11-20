/**
 * ModuleManagementService.ts — Service de gestion centralisée des modules Hub v2.0
 * Permet d'énumérer, créer, modifier, basculer public/privé, rechercher et exporter
 * les modules système et les modules personnalisés (privés ou publics).
 */

export interface ManagedModule {
  id: string;
  name: string;
  version: string;
  author: string;
  resource_type: 'crypto_module' | 'map_provider' | 'routing_engine' | 'path_provider' | 'raid_trame' | 'theme_style';
  data_capability?: 'alphabetic' | 'numeric' | 'alphanumeric' | 'symbolic_visual' | 'map_path' | 'elevation_profile' | 'map_overview';
  description: string;
  is_public: boolean;
  is_builtin: boolean;
  created_at?: string;
  updated_at?: string;
  tags: string[];
  manifest?: Record<string, any>;
  color?: string;
  badge?: string;
  s3_url?: string;
  s3_sha256?: string;
  is_s3_synced?: boolean;
}

const STORAGE_KEY_CUSTOM_MODULES = 'scoutraider_user_custom_modules';
const STORAGE_KEY_DISABLED_LIB = 'scoutraider_hub_disabled_ids';

export const BUILTIN_MANAGED_MODULES: ManagedModule[] = [
  {
    id: 'gilwell',
    name: 'Piste Gilwell (Azimuts & Métrages)',
    version: '2.0.0',
    author: 'ScoutRaider Team',
    resource_type: 'crypto_module',
    data_capability: 'map_path',
    description: 'Éditeur WYSIWYG de relevés de route d\'azimuts et distances avec pagination multi-colonnes et connecteurs.',
    is_public: true,
    is_builtin: true,
    tags: ['topo', 'orientation', 'azimut', 'wysiwyg', 'map_path'],
    color: '#10b981',
    badge: 'Standard v2'
  },
  {
    id: 'morse',
    name: 'Code Morse International',
    version: '2.0.0',
    author: 'ScoutRaider Core Team',
    resource_type: 'crypto_module',
    data_capability: 'alphabetic',
    description: 'Transmission par signaux sonores, lumineux ou tracés sous forme de points et de traits.',
    is_public: true,
    is_builtin: true,
    tags: ['crypto', 'morse', 'sonore', 'lumineux'],
    color: '#ef4444',
    badge: 'Standard v2'
  },
  {
    id: 'vigenere',
    name: 'Chiffre de Vigenère',
    version: '2.0.0',
    author: 'ScoutRaider Core Team',
    resource_type: 'crypto_module',
    data_capability: 'alphanumeric',
    description: 'Chiffrement polyalphabétique avec mot-clé de sécurité personnalisé pour scouts confirmés.',
    is_public: true,
    is_builtin: true,
    tags: ['crypto', 'vigenere', 'polyalphabetique', 'cle'],
    color: '#8b5cf6',
    badge: 'Standard v2'
  },
  {
    id: 'polybe',
    name: 'Carré de Polybe 6×6',
    version: '2.0.0',
    author: 'ScoutRaider Core Team',
    resource_type: 'crypto_module',
    data_capability: 'alphanumeric',
    description: 'Substitution par coordonnées de grille matricielle (lignes/colonnes) gérant lettres et chiffres.',
    is_public: true,
    is_builtin: true,
    tags: ['crypto', 'polybe', 'grille', 'matrice'],
    color: '#14b8a6',
    badge: 'Standard v2'
  },
  {
    id: 'avocat',
    name: 'Code Avocat (A=K)',
    version: '2.0.0',
    author: 'ScoutRaider Core Team',
    resource_type: 'crypto_module',
    data_capability: 'alphabetic',
    description: 'Décalage alphabétique César de 10 crans permettant un déchiffrement intuitif sur le terrain.',
    is_public: true,
    is_builtin: true,
    tags: ['crypto', 'cesar', 'avocat', 'decalage'],
    color: '#f59e0b',
    badge: 'Standard v2'
  },
  {
    id: 'cassis',
    name: 'Code Cassis (K=6)',
    version: '2.0.0',
    author: 'ScoutRaider Core Team',
    resource_type: 'crypto_module',
    data_capability: 'alphanumeric',
    description: 'Variante scoute classique décalant l\'alphabet par rapport aux indices numériques.',
    is_public: true,
    is_builtin: true,
    tags: ['crypto', 'cassis', 'chiffres'],
    color: '#7c3aed',
    badge: 'Standard v2'
  },
  {
    id: 'templier',
    name: 'Croix des Templiers',
    version: '2.0.0',
    author: 'ScoutRaider Core Team',
    resource_type: 'crypto_module',
    data_capability: 'symbolic_visual',
    description: 'Chiffre maçonnique / pigpen traditionnel tracé dans les branches de croix géométriques.',
    is_public: true,
    is_builtin: true,
    tags: ['crypto', 'pigpen', 'templiers', 'symboles'],
    color: '#b45309',
    badge: 'Standard v2'
  },
  {
    id: 'maritime',
    name: 'Pavillons Maritimes NATO',
    version: '2.0.0',
    author: 'ScoutRaider Core Team',
    resource_type: 'crypto_module',
    data_capability: 'symbolic_visual',
    description: 'Alphabet de signaux maritimes internationaux et phonétique NATO pour épreuves de vigie.',
    is_public: true,
    is_builtin: true,
    tags: ['crypto', 'flags', 'nato', 'marine'],
    color: '#0ea5e9',
    badge: 'Standard v2'
  },
  {
    id: 'profil_altimetrique',
    name: 'Profil Altimétrique & Relief',
    version: '2.0.0',
    author: 'ScoutRaider Core Team',
    resource_type: 'crypto_module',
    data_capability: 'elevation_profile',
    description: 'Courbe de relief altimétrique vectorielle, calcul des dénivelés cumulés D+/D- et pentes.',
    is_public: true,
    is_builtin: true,
    tags: ['topo', 'altimetrie', 'denivele', 'elevation'],
    color: '#0284c7',
    badge: 'Standard v2'
  },
  {
    id: 'apercu_carte',
    name: 'Aperçu Synoptique de Carte',
    version: '2.0.0',
    author: 'ScoutRaider Core Team',
    resource_type: 'crypto_module',
    data_capability: 'map_overview',
    description: 'Cartouche cartographique général de raid avec vue synoptique, échelle et boîte de sécurité.',
    is_public: true,
    is_builtin: true,
    tags: ['topo', 'carte', 'synoptique', 'vue_ensemble'],
    color: '#16a34a',
    badge: 'Standard v2'
  },
  {
    id: 'routing_brouter',
    name: 'Moteur BRouter Randonnée',
    version: '2.0.0',
    author: 'ScoutRaider Team & BRouter',
    resource_type: 'routing_engine',
    description: 'Moteur de calcul de chemins pédestres privilégiant les sentiers GR/PR et évitant le bitume.',
    is_public: true,
    is_builtin: true,
    tags: ['routing', 'chemins', 'brouter', 'randonnee'],
    color: '#10b981',
    badge: 'Moteur'
  },
  {
    id: 'routing_valhalla_ign',
    name: 'Moteur Valhalla BD TOPO IGN',
    version: '2.0.0',
    author: 'IGN France',
    resource_type: 'routing_engine',
    description: 'Moteur souverain français calculant les tracés sur le référentiel topographique national.',
    is_public: true,
    is_builtin: true,
    tags: ['routing', 'ign', 'valhalla', 'bd_topo'],
    color: '#0284c7',
    badge: 'Moteur'
  },
  {
    id: 'routing_direct',
    name: 'Azimut Direct & Boussole',
    version: '2.0.0',
    author: 'ScoutRaider Core Team',
    resource_type: 'routing_engine',
    description: 'Calcul 100% hors-ligne de trajectoires rectilignes à vol d\'oiseau pour marche au cap.',
    is_public: true,
    is_builtin: true,
    tags: ['routing', 'azimut', 'direct', 'boussole'],
    color: '#f59e0b',
    badge: 'Moteur'
  },
  {
    id: 'loader_gpx',
    name: 'Chargeur GPX Universel',
    version: '2.0.0',
    author: 'ScoutRaider Core Team',
    resource_type: 'path_provider',
    description: 'Importation et décodage de traces GPS, altitudes et balises au standard GPX 1.0 / 1.1.',
    is_public: true,
    is_builtin: true,
    tags: ['loader', 'chemins', 'gpx', 'gps'],
    color: '#8b5cf6',
    badge: 'Chargeur'
  },
  {
    id: 'loader_geojson',
    name: 'Chargeur Vectoriel GeoJSON SIG',
    version: '2.0.0',
    author: 'ScoutRaider Core Team',
    resource_type: 'path_provider',
    description: 'Importation de couches vectorielles, tracés libres et waypoints aux formats GeoJSON et KML.',
    is_public: true,
    is_builtin: true,
    tags: ['loader', 'chemins', 'geojson', 'sig'],
    color: '#ec4899',
    badge: 'Chargeur'
  }
];

export class ModuleManagementService {
  /**
   * Récupère la liste fusionnée de tous les modules (socle système + créations locales).
   */
  static getAllModules(): ManagedModule[] {
    const custom = this.getCustomModules();
    const customMap = new Map<string, ManagedModule>();
    for (const m of custom) {
      customMap.set(m.id, m);
    }

    // Merge: custom overrides builtins if same ID
    const merged: ManagedModule[] = [];
    for (const b of BUILTIN_MANAGED_MODULES) {
      const s3Url = b.s3_url || `https://s3-scoutraider.silverhorse.fr/scoutraider-assets/modules/${b.id}-${b.version}.zip`;
      if (customMap.has(b.id)) {
        const customItem = customMap.get(b.id)!;
        merged.push({
          ...customItem,
          s3_url: customItem.s3_url || s3Url,
          is_s3_synced: customItem.is_s3_synced ?? true
        });
        customMap.delete(b.id);
      } else {
        merged.push({
          ...b,
          s3_url: s3Url,
          is_s3_synced: true
        });
      }
    }

    // Add remaining custom modules
    for (const m of customMap.values()) {
      merged.push(m);
    }

    return merged;
  }

  /**
   * Récupère uniquement les modules personnalisés créés ou modifiés par l'utilisateur.
   */
  static getCustomModules(): ManagedModule[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_MODULES);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Enregistre ou met à jour un module personnalisé.
   */
  static saveCustomModule(moduleData: Partial<ManagedModule> & { id: string; name: string }): ManagedModule {
    const custom = this.getCustomModules();
    const existingIdx = custom.findIndex(m => m.id === moduleData.id);

    const now = new Date().toISOString();
    const fullModule: ManagedModule = {
      id: moduleData.id,
      name: moduleData.name,
      version: moduleData.version || '1.0.0',
      author: moduleData.author || 'Moi (Chef de Troupe)',
      resource_type: moduleData.resource_type || 'crypto_module',
      data_capability: moduleData.data_capability || 'alphabetic',
      description: moduleData.description || 'Module personnalisé pour le raid.',
      is_public: moduleData.is_public ?? false,
      is_builtin: false,
      created_at: existingIdx >= 0 ? custom[existingIdx].created_at : now,
      updated_at: now,
      tags: moduleData.tags || ['custom', 'raid'],
      color: moduleData.color || '#3b82f6',
      badge: moduleData.is_public ? 'Public' : 'Privé',
      manifest: moduleData.manifest || this.generateDefaultManifest(moduleData)
    };

    if (existingIdx >= 0) {
      custom[existingIdx] = fullModule;
    } else {
      custom.unshift(fullModule);
    }

    localStorage.setItem(STORAGE_KEY_CUSTOM_MODULES, JSON.stringify(custom));
    return fullModule;
  }

  /**
   * Bascule le statut de visibilité Public <-> Privé d'un module.
   */
  static togglePublicStatus(moduleId: string): boolean {
    const custom = this.getCustomModules();
    let mod = custom.find(m => m.id === moduleId);

    if (!mod) {
      // If it's a builtin, create a local override
      const builtin = BUILTIN_MANAGED_MODULES.find(m => m.id === moduleId);
      if (!builtin) return false;
      mod = { ...builtin, is_builtin: false, is_public: !builtin.is_public, badge: !builtin.is_public ? 'Public' : 'Privé' };
      custom.push(mod);
    } else {
      mod.is_public = !mod.is_public;
      mod.badge = mod.is_public ? 'Public' : 'Privé';
      mod.updated_at = new Date().toISOString();
    }

    localStorage.setItem(STORAGE_KEY_CUSTOM_MODULES, JSON.stringify(custom));
    return mod.is_public;
  }

  /**
   * Supprime un module personnalisé de l'espace local.
   */
  static deleteCustomModule(moduleId: string): boolean {
    const custom = this.getCustomModules();
    const filtered = custom.filter(m => m.id !== moduleId);
    if (filtered.length !== custom.length) {
      localStorage.setItem(STORAGE_KEY_CUSTOM_MODULES, JSON.stringify(filtered));
      return true;
    }
    return false;
  }

  /**
   * Vérifie si un module est actuellement actif dans "Ma Bibliothèque".
   */
  static isInLibrary(moduleId: string): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DISABLED_LIB);
      if (!raw) return true; // Actif par défaut
      const disabled: string[] = JSON.parse(raw);
      return !disabled.includes(moduleId);
    } catch {
      return true;
    }
  }

  /**
   * Active ou désactive un module dans "Ma Bibliothèque".
   */
  static toggleLibraryActive(moduleId: string): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DISABLED_LIB);
      let disabled: string[] = raw ? JSON.parse(raw) : [];
      const isCurrentlyDisabled = disabled.includes(moduleId);

      if (isCurrentlyDisabled) {
        disabled = disabled.filter(id => id !== moduleId);
      } else {
        disabled.push(moduleId);
      }

      localStorage.setItem(STORAGE_KEY_DISABLED_LIB, JSON.stringify(disabled));
      return isCurrentlyDisabled; // returns new active state (true if it was disabled)
    } catch {
      return true;
    }
  }

  /**
   * Génère un manifeste Hub v2 conforme pour un module.
   */
  static generateDefaultManifest(mod: Partial<ManagedModule>): Record<string, any> {
    return {
      $schema: 'https://scoutraider.org/schemas/v2/module.schema.json',
      schema_version: '2.0',
      id: mod.id || 'mon_module',
      name: mod.name || 'Mon Module',
      version: mod.version || '1.0.0',
      resource_type: mod.resource_type || 'crypto_module',
      author: mod.author || 'Moi (Chef de Troupe)',
      license: 'MIT',
      description: mod.description || 'Description pédagogique du module.',
      data_capability: mod.data_capability || 'alphabetic',
      entrypoint: 'index.ts',
      is_public: mod.is_public ?? false,
      pedagogy: {
        recommended_levels: ['seconde_classe', 'premiere_classe'],
        difficulty_weight: 2.0
      },
      constraints: {
        max_proportion: 0.35,
        allow_consecutive: false,
        min_distance_m: 500
      },
      tags: mod.tags || ['custom']
    };
  }

  /**
   * Télécharge le manifeste au format .json prêt pour le packaging Hub v2.
   */
  static exportManifestJson(mod: ManagedModule) {
    const manifest = mod.manifest || this.generateDefaultManifest(mod);
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manifest-${mod.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Enregistre et publie un module personnalisé directement dans le bucket S3 Garage (scoutraider-assets).
   */
  static async publishModuleToS3(mod: ManagedModule): Promise<{ success: boolean; s3_url?: string; error?: string }> {
    try {
      const manifest = mod.manifest || this.generateDefaultManifest(mod);
      const res = await fetch('/api/hub/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifest,
          files: {
            'manifest.json': JSON.stringify(manifest, null, 2),
            'README.md': `# ${mod.name}\n\n${mod.description}\n\nEnregistré dans le bucket S3 Garage (scoutraider-assets).`
          }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Échec de publication vers S3' }));
        throw new Error(err.detail || `Erreur HTTP ${res.status}`);
      }

      const data = await res.json();
      // Mettre à jour l'enregistrement local avec l'URL S3
      this.saveCustomModule({
        ...mod,
        s3_url: data.s3_url,
        s3_sha256: data.sha256,
        is_s3_synced: true
      });

      return { success: true, s3_url: data.s3_url };
    } catch (e: any) {
      console.error('[ModuleManagementService] S3 publish error:', e);
      return { success: false, error: e?.message || 'Erreur lors de la publication vers le bucket S3.' };
    }
  }
}

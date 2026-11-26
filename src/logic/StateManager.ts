/**
 * StateManager.ts — Complete React-compatible store with IPC persistence.
 * Ported from legacy/state_manager.py
 * 
 * Handles:
 * - Initial state creation
 * - State mutation helpers for the reducer
 * - Serialization / deserialization for .srdoc files
 * - IPC wrappers for Electron save/load/export
 */

import type { AppState, RouteDict, PolySegment, ExportJob } from './types';
import { calculatePolygonArea, formatArea } from './GeoUtils';

const CURRENT_SCHEMA_VERSION = '5.0.0';

export class StateManager {

    // ─── Initial State ────────────────────────────────────────────────────
    static getInitialState(): AppState {
        // Default preferences
        let prefs = {
            active_ign_layer: 'PLAN.IGN',
            mapy_api_key: '',
            ign_api_key: '',
            show_pois_on_map: false,
            show_dangers_on_map: false,
            show_stages_on_map: true,
            auto_check_updates: true,
        };

        // Attempt to load from localStorage
        if (typeof window !== 'undefined') {
            try {
                const storedPrefs = localStorage.getItem('scoutraider_prefs');
                if (storedPrefs) {
                    const parsed = JSON.parse(storedPrefs);
                    if (parsed.active_ign_layer) prefs.active_ign_layer = parsed.active_ign_layer;
                    if (parsed.mapy_api_key) prefs.mapy_api_key = parsed.mapy_api_key;
                    if (parsed.ign_api_key) prefs.ign_api_key = parsed.ign_api_key;
                    if (parsed.show_pois_on_map !== undefined) prefs.show_pois_on_map = parsed.show_pois_on_map;
                    if (parsed.show_dangers_on_map !== undefined) prefs.show_dangers_on_map = parsed.show_dangers_on_map;
                    if (parsed.show_stages_on_map !== undefined) prefs.show_stages_on_map = parsed.show_stages_on_map;
                    if (parsed.auto_check_updates !== undefined) prefs.auto_check_updates = parsed.auto_check_updates;
                }
            } catch (e) {
                console.warn('Failed to load preferences from localStorage', e);
            }
        }

        const defaultAnnotationLayers = [
            { id: 'layer-points', name: 'Points & Repères', type: 'points' as const, visible: true, color: '#3b82f6', isDefault: true },
            { id: 'layer-areas', name: 'Zones & Périmètres', type: 'areas' as const, visible: true, color: '#10b981', isDefault: true }
        ];

        return {
            version: CURRENT_SCHEMA_VERSION,
            document_title: '',
            document_title_synced: false,
            current_filepath: null,
            active_mode: 'map',

            routes: [],
            active_route_id: null,
            route_chain: [],

            itineraries: [],
            active_itinerary_id: '',

            annotation_layers: defaultAnnotationLayers,
            point_annotations: [],
            area_annotations: [],
            draw_annotations: [],
            text_annotations: [],
            layer_order: [],

            stages: [],
            geojson_data: null,

            polygonalization_settings: {
                tolerance: 45,
                allow_offroad: false,
                force_intersections: true,
                min_dist: 80,
                bypassed: false,
                masked_nodes: [],
                forced_nodes: []
            },
            polygonal_steps: [],
            polygonal_legs: {},
            pending_azimut_legs: [],

            distribution_mode: 'auto',
            active_preset_id: 'seconde_classe_1',
            custom_assignments: {},
            custom_languages: {},

            active_tool: 'route',
            anchor_stage_idx: -1,
            show_azimuth_arrows: false,
            active_ign_layer: prefs.active_ign_layer,
            mapy_api_key: prefs.mapy_api_key,
            ign_api_key: prefs.ign_api_key,
            small_roads_only: false,
            show_pois_on_map: prefs.show_pois_on_map,
            show_dangers_on_map: prefs.show_dangers_on_map,
            show_stages_on_map: prefs.show_stages_on_map,
            auto_check_updates: prefs.auto_check_updates,
            segment_pois: {},

            theme_id: 'Neutre',
            theme_overrides: {},

            carnet_steps: [
                {
                    id: 'manual-title',
                    fromLabel: '',
                    toLabel: '',
                    moduleId: 'texte_clair',
                    distanceM: 0,
                    azimuth: 0,
                    coords: [],
                    solutionText: '',
                    encodedText: '',
                    warnings: [],
                    isManual: true,
                    manualType: 'html',
                    isTitleStep: true,
                    anchorSegmentIdx: -1,
                }
            ],
            carnet_view: 'participant',
            carnet_include_general_map: true,
            carnet_include_elevation_profile: false,
            enabled_annexes: [],

            export_queue: [],

            // Transient UI state
            is_loading: false,
            loading_text: '',
            notifications: [],
            selected_layer_id: null,
            selected_sublayer_id: null,
            // ☁️ Cloud Sync
            cloud_sync_status: 'offline',
            cloud_last_synced: null,
            cloud_project_id: null,
            cloud_share_token: null,
            autosave_enabled: true,
        };
    }

    // ─── Serialization (for .scoutproj persistence) ───────────────────────

    /**
     * Serialize state for saving to a .srdoc file.
     * Strips transient UI fields and adds metadata.
     */
    static serializeForSave(state: AppState): string {
        // Deep clone and strip transient fields
        const persistable: any = { ...state };
        delete persistable.is_loading;
        delete persistable.loading_text;
        delete persistable.notifications;
        delete persistable.mapy_api_key;
        delete persistable.ign_api_key;
        delete persistable.current_filepath;
        // Cloud sync transient fields (not persisted)
        delete persistable.cloud_sync_status;
        delete persistable.cloud_last_synced;
        // cloud_project_id et cloud_share_token SONT persistés pour retrouver le projet cloud
        // autosave_enabled est persisté

        const envelope = {
            _scoutproj: true,
            _version: CURRENT_SCHEMA_VERSION,
            _savedAt: new Date().toISOString(),
            state: persistable
        };

        return JSON.stringify(envelope, null, 2);
    }

    /**
     * Save only global preferences to localStorage.
     */
    static savePreferences(state: AppState) {
        if (typeof window === 'undefined') return;
        const prefs = {
            active_ign_layer: state.active_ign_layer,
            mapy_api_key: state.mapy_api_key,
            ign_api_key: state.ign_api_key,
            show_pois_on_map: state.show_pois_on_map,
            show_dangers_on_map: state.show_dangers_on_map,
            show_stages_on_map: state.show_stages_on_map,
            auto_check_updates: state.auto_check_updates,
        };
        localStorage.setItem('scoutraider_prefs', JSON.stringify(prefs));
    }

    /**
     * Détecte si un état est au format legacy (v5.x) vs nouveau (v2.0+ avec champs cloud)
     */
    static isLegacyFormat(state: any): boolean {
        // L'ancien format n'a pas les champs cloud sync
        return state.cloud_sync_status === undefined &&
               state.cloud_project_id === undefined &&
               state.autosave_enabled === undefined;
    }

    /**
     * Convertit un ancien état v5.x vers le nouveau format v2.0 (avec enveloppe)
     * Appelé automatiquement à l'ouverture d'un fichier .srdoc legacy
     */
    static convertLegacyToV2(legacyState: any): AppState {
        console.log('[StateManager] Conversion legacy v5 → v2.0 détectée, migration en cours...');

        const defaults = StateManager.getInitialState();

        // Construire le document V2 depuis l'ancien carnet_steps
        const documentV2 = this.buildDocumentV2FromLegacy(legacyState);

        // Fusionner avec les defaults pour avoir tous les champs cloud
        const migrated: AppState = {
            ...defaults,
            ...legacyState,
            // Écraser carnet_steps par la version convertie si nécessaire
            carnet_steps: this.convertLegacyCarnetSteps(legacyState.carnet_steps || []),
            // Champs cloud ajoutés
            cloud_sync_status: 'offline',
            cloud_last_synced: null,
            cloud_project_id: null,
            cloud_share_token: null,
            autosave_enabled: true,
            // Garder les préférences UI
            active_mode: legacyState.active_mode || 'map',
            active_tool: legacyState.active_tool || 'route',
            theme_id: legacyState.theme_id || 'Neutre',
        };

        // Sauvegarder l'ancien project_name comme document_title si pas de titre
        if (!migrated.document_title && (legacyState as any).project_name) {
            migrated.document_title = (legacyState as any).project_name;
        }

        console.log('[StateManager] Migration terminée avec succès');
        return migrated;
    }

    /**
     * Construit un DocumentV2 complet depuis l'état legacy pour export/sauvegarde
     */
    static buildDocumentV2FromLegacy(state: any) {
        const now = new Date().toISOString();
        const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        return {
            schemaVersion: '2.0',
            id: docId,
            title: state.document_title || (state as any).project_name || 'Document sans titre',
            createdAt: now,
            updatedAt: now,
            version: 1,
            assets: this.extractAssetsFromLegacyState(state),
            pageLayout: this.getDefaultPageLayout(),
            blocks: this.convertLegacyCarnetStepsToBlocks(state.carnet_steps || [], state),
            settings: this.getDefaultSettings()
        };
    }

    /**
     * Extrait les assets (polices, images) depuis l'état legacy
     */
    static extractAssetsFromLegacyState(state: any): { fonts: any[]; images: Record<string, any> } {
        const fonts: any[] = [];
        const images: Record<string, any> = {};

        // Polices utilisées par les modules de chiffrement dans carnet_steps
        const usedModules = new Set<string>(
            (state.carnet_steps || [])
                .map((s: any) => s.moduleId as string)
                .filter(Boolean)
        );

        const moduleFonts: Record<string, { family: string; weight: number }> = {
            morse: { family: 'Morse', weight: 400 },
            templier: { family: 'TemplarsCipherPlus', weight: 400 },
            maritime: { family: 'Maritime', weight: 400 },
        };

        usedModules.forEach(mod => {
            if (moduleFonts[mod]) {
                fonts.push({
                    id: `font_${mod}`,
                    family: moduleFonts[mod].family,
                    weight: moduleFonts[mod].weight,
                    assetId: `fonts/${mod}.woff2`,
                    path: `assets/fonts/${mod}.woff2`,
                    mimeType: 'font/woff2'
                });
            }
        });

        // Police par défaut
        fonts.unshift({
            id: 'font_default',
            family: 'system-ui',
            weight: 400,
            assetId: '',
            path: '',
            mimeType: ''
        });

        // Images des cartes (étapes carte_ign, carte_simple, drapeaux)
        let imgCounter = 0;
        (state.carnet_steps || []).forEach((step: any) => {
            if (['carte_ign', 'carte_simple', 'drapeaux'].includes(step.moduleId) && step.coords?.length) {
                const assetId = `map_${step.id}`;
                const imgKey = `img_${++imgCounter}`;
                images[imgKey] = {
                    assetId,
                    path: `assets/images/${assetId}.webp`,
                    width: step.mapPersist?.width || 800,
                    height: step.mapPersist?.height || 600,
                    mimeType: 'image/webp',
                    originalName: `carte-${step.fromLabel}-${step.toLabel}.webp`
                };
            }
        });

        return { fonts, images };
    }

    /**
     * Convertit les anciens carnet_steps en blocs V2
     */
    static convertLegacyCarnetStepsToBlocks(steps: any[], state: any): any[] {
        const blocks: any[] = [];
        let order = 0;

        // Page de garde (toujours en premier)
        const titleStep = steps.find((s: any) => s.isTitleStep);
        if (titleStep) {
            blocks.push({
                id: `blk_title_${Date.now()}`,
                type: 'title_page',
                locked: false,
                autoUpdate: false,
                dependsOn: [],
                order: order++,
                config: {
                    title: titleStep.solutionText?.replace(/<[^>]+>/g, '').trim() || 'Carnet de Raid',
                    subtitle: `Raid du ${new Date().toLocaleDateString('fr-FR')}`,
                    author: 'ScoutRaider',
                    date: new Date().toISOString().split('T')[0]
                }
            });
        } else {
            // Page de garde par défaut si pas de titre
            blocks.push({
                id: `blk_title_${Date.now()}`,
                type: 'title_page',
                locked: false,
                autoUpdate: false,
                dependsOn: [],
                order: order++,
                config: {
                    title: 'Carnet de Raid',
                    subtitle: `Raid du ${new Date().toLocaleDateString('fr-FR')}`,
                    author: 'ScoutRaider',
                    date: new Date().toISOString().split('T')[0]
                }
            });
        }

        // Étapes du carnet
        steps.forEach((step: any) => {
            if (step.isTitleStep) return;

            if (step.isManual) {
                // Bloc manuel (commentaire ou code saisi à la main)
                if (step.manualType === 'html') {
                    blocks.push({
                        id: step.id || `blk_manual_${Date.now()}_${order}`,
                        type: 'rich_text',
                        locked: false,
                        autoUpdate: false,
                        dependsOn: [],
                        order: order++,
                        content: [{ type: 'paragraph', text: step.solutionText || '' }]
                    });
                } else if (step.manualType === 'code') {
                    blocks.push({
                        id: step.id || `blk_manual_${Date.now()}_${order}`,
                        type: 'crypto_block',
                        locked: false,
                        autoUpdate: false,
                        dependsOn: [],
                        order: order++,
                        config: {
                            cipher: step.moduleId as any,
                            key: step.moduleId === 'vigenere' ? require('../ThemeManager').themeManager.getTheme(state.theme_id || 'Neutre').vigenere_key : undefined,
                            sourceText: step.solutionText || '',
                            renderedText: step.encodedText || step.solutionText || '',
                            autoRegenerate: false
                        }
                    });
                }
            } else {
                // Bloc calculé (généré depuis l'itinéraire)
                if (['morse', 'vigenere', 'polybe', 'templier', 'maritime', 'avocat', 'cassis'].includes(step.moduleId)) {
                    blocks.push({
                        id: step.id || `blk_crypto_${Date.now()}_${order}`,
                        type: 'crypto_block',
                        locked: true,           // Protégé : généré automatiquement
                        autoUpdate: true,       // Recalculé si l'itinéraire change
                        dependsOn: step.segmentIndices?.map((i: number) => `segment_${i}`) || [],
                        order: order++,
                        config: {
                            cipher: step.moduleId as any,
                            key: step.moduleId === 'vigenere' ? require('../ThemeManager').themeManager.getTheme(state.theme_id || 'Neutre').vigenere_key : undefined,
                            sourceText: step.solutionText || '',
                            renderedText: step.encodedText || step.solutionText || '',
                            autoRegenerate: true
                        }
                    });
                } else if (['carte_ign', 'carte_simple', 'drapeaux'].includes(step.moduleId)) {
                    blocks.push({
                        id: step.id || `blk_map_${Date.now()}_${order}`,
                        type: 'map_snippet',
                        locked: true,
                        autoUpdate: !step.mapPersist?.isLocked,
                        dependsOn: step.segmentIndices?.map((i: number) => `segment_${i}`) || [],
                        order: order++,
                        config: {
                            center: step.mapPersist?.center || step.mapCenter || [48.85, 2.35],
                            zoom: step.mapPersist?.zoom || step.mapZoom || 15,
                            width: step.mapPersist?.width || 800,
                            height: step.mapPersist?.height || 600,
                            scaleName: step.mapPersist?.scaleName || '1:25000',
                            layerId: step.mapPersist?.layerId || 'PLAN.IGN',
                            showRoute: step.mapPersist?.showRoute ?? true,
                            showEndpoints: step.mapPersist?.showEndpoints ?? true,
                            showAnnotations: step.mapPersist?.showAnnotations ?? true,
                            routeCoords: step.coords?.map((c: any) => [c[1], c[0]])
                        }
                    });
                } else if (step.moduleId === 'gilwell' && step.gilwellSvg) {
                    blocks.push({
                        id: step.id || `blk_gilwell_${Date.now()}_${order}`,
                        type: 'rich_text',
                        locked: true,
                        autoUpdate: true,
                        dependsOn: step.segmentIndices?.map((i: number) => `segment_${i}`) || [],
                        order: order++,
                        content: [{ type: 'code_block', text: step.gilwellSvg, language: 'svg' }]
                    });
                } else {
                    // Texte clair ou autre
                    blocks.push({
                        id: step.id || `blk_text_${Date.now()}_${order}`,
                        type: 'rich_text',
                        locked: true,
                        autoUpdate: true,
                        dependsOn: step.segmentIndices?.map((i: number) => `segment_${i}`) || [],
                        order: order++,
                        content: [{ type: 'paragraph', text: step.solutionText || '' }]
                    });
                }
            }
        });

        // Ajouter les annexes si modules utilisés
        const usedModules = new Set(steps.map((s: any) => s.moduleId).filter(Boolean));
        const moduleToAnnexe: Record<string, any> = {
            morse: { type: 'morse', title: 'Table Morse International', content: '' },
            polybe: { type: 'polybe', title: 'Carré de Polybe', content: '' },
            vigenere: { type: 'vigenere', title: 'Table de Vigenère', content: '' },
            maritime: { type: 'maritime', title: 'Code Maritime & Pavillons NATO', content: '' },
            templier: { type: 'templier', title: 'Croix Templière', content: '' },
            avocat: { type: 'avocat', title: 'Méthode Avocat (A=K / Décalage +10)', content: '' }
        };

        usedModules.forEach(mod => {
            if (moduleToAnnexe[mod]) {
                blocks.push({
                    id: `blk_annexe_${mod}_${Date.now()}`,
                    type: 'annexe',
                    locked: true,
                    autoUpdate: false,
                    dependsOn: [],
                    order: 1000 + order++,
                    config: moduleToAnnexe[mod]
                });
            }
        });

        return blocks;
    }

    /**
     * Convertit les carnet_steps legacy en format compatible (garde la structure existante pour l'éditeur)
     */
    static convertLegacyCarnetSteps(steps: any[]): any[] {
        return (steps || []).map(step => ({
            ...step,
            // S'assurer que les champs requis existent
            id: step.id || `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            warnings: step.warnings || [],
            isEdited: step.isEdited || false,
            anchorSegmentIdx: step.anchorSegmentIdx ?? -1
        }));
    }

    static getDefaultPageLayout() {
        return {
            format: 'A4' as const,
            orientation: 'portrait' as const,
            margins: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
            header: { enabled: true, left: 'Troupe 1ère Port-Marly', right: '{{document.title}}', fontSize: '8pt', color: '#666666' },
            footer: { enabled: true, center: 'Page {{page}} / {{pages}}', fontSize: '8pt', color: '#999999' },
            backgroundColor: '#ffffff'
        };
    }

    static getDefaultSettings() {
        return {
            autoSave: true,
            autoSaveInterval: 1000,
            spellCheck: true,
            showInvisibles: false,
            defaultFontFamily: 'system-ui',
            defaultFontSize: '11pt',
            theme: 'system' as const
        };
    }

    /**
     * Deserialize a .srdoc JSON string back into AppState.
     * Handles schema migration for older versions.
     * AUTO-CONVERTIT le format legacy v5 → v2.0 automatiquement
     */
    static deserializeFromLoad(json: string): AppState {
        const data = JSON.parse(json);

        let loadedState: AppState;

        if (data._scoutproj) {
            // Nouveau format avec enveloppe (v2.0+)
            loadedState = data.state as AppState;
            loadedState.version = data._version || CURRENT_SCHEMA_VERSION;
        } else {
            // Format legacy v5.x (objet brut sans enveloppe)
            loadedState = data as AppState;
        }

        // 🔄 AUTO-CONVERSION : Si format legacy, convertir vers v2.0
        if (this.isLegacyFormat(loadedState)) {
            return this.convertLegacyToV2(loadedState);
        }

        // Migration des champs manquants pour format v2.0+
        const defaults = StateManager.getInitialState();
        const migrated: AppState = { ...defaults, ...loadedState };

        migrated.document_title = loadedState.document_title || (loadedState as any).project_name || 'Document sans titre';
        migrated.current_filepath = loadedState.current_filepath || null;

        // Ensure transient fields are reset
        migrated.is_loading = false;
        migrated.loading_text = '';
        migrated.notifications = [];

        // Ensure arrays exist (protection against corrupted files)
        if (!Array.isArray(migrated.stages)) migrated.stages = [];
        if (!Array.isArray(migrated.routes)) migrated.routes = [];
        // Ensure arrays exist
        if (!Array.isArray(migrated.polygonal_steps)) migrated.polygonal_steps = [];
        if (!Array.isArray(migrated.carnet_steps)) migrated.carnet_steps = [];

        // Ensure multi-itinerary support (only auto-wrap legacy root stages if non-empty)
        if (!Array.isArray(migrated.itineraries) || migrated.itineraries.length === 0) {
            const hasLegacyContent =
                migrated.stages.length > 0 ||
                migrated.routes.length > 0 ||
                migrated.polygonal_steps.length > 0 ||
                migrated.carnet_steps.length > 0;
            if (hasLegacyContent) {
                migrated.itineraries = [
                    {
                        id: 'itin-1',
                        name: 'Itinéraire 1',
                        color: '#2d8ceb',
                        visible: true,
                        stages: [...migrated.stages],
                        routes: [...migrated.routes],
                        polygonal_steps: [...migrated.polygonal_steps],
                        polygonal_legs: { ...migrated.polygonal_legs },
                        carnet_steps: [...migrated.carnet_steps],
                        custom_assignments: { ...(migrated.custom_assignments || {}) },
                        custom_languages: { ...(migrated.custom_languages || {}) }
                    }
                ];
                migrated.active_itinerary_id = 'itin-1';
            } else {
                migrated.itineraries = [];
                migrated.active_itinerary_id = '';
            }
        } else {
            // Filter out empty itineraries on load
            migrated.itineraries = migrated.itineraries.filter(
                it => (it.stages?.length || 0) > 0 || ((it as any).manual_steps?.length || 0) > 0 || (it.polygonal_steps?.length || 0) > 0
            );
            if (migrated.itineraries.length === 0) {
                migrated.active_itinerary_id = '';
            } else if (!migrated.active_itinerary_id || !migrated.itineraries.some(it => it.id === migrated.active_itinerary_id)) {
                migrated.active_itinerary_id = migrated.itineraries[migrated.itineraries.length - 1].id;
            }
        }

        // Ensure annotations and annotation layers
        if (!Array.isArray(migrated.annotation_layers) || migrated.annotation_layers.length === 0) {
            migrated.annotation_layers = [
                { id: 'layer-points', name: 'Points & Repères', type: 'points', visible: true, color: '#3b82f6', isDefault: true },
                { id: 'layer-areas', name: 'Zones & Périmètres', type: 'areas', visible: true, color: '#10b981', isDefault: true }
            ];
        }
        if (!Array.isArray(migrated.point_annotations)) migrated.point_annotations = [];
        if (!Array.isArray(migrated.draw_annotations))  migrated.draw_annotations = [];
        if (!Array.isArray(migrated.text_annotations))  migrated.text_annotations = [];
        if (!Array.isArray(migrated.layer_order))       migrated.layer_order = [];
        // Migrate legacy strokes: [number,number][][] → DrawStroke[]
        migrated.draw_annotations = migrated.draw_annotations.map((d: any) => {
            if (!Array.isArray(d.strokes)) return { ...d, strokes: [] };
            const strokes = d.strokes.map((s: any, idx: number) => {
                // Already migrated (has id and points)
                if (s && typeof s === 'object' && s.id && s.points) return s;
                // Legacy: s is [number, number][]
                return {
                    id: `stroke-legacy-${d.id}-${idx}`,
                    points: s,
                    color: d.color || '#ef4444',
                    strokeWidth: d.strokeWidth || 4,
                    opacity: d.opacity || 0.85,
                    createdAt: d.createdAt || Date.now(),
                };
            });
            return { ...d, strokes };
        });
        if (!Array.isArray(migrated.area_annotations)) {
            migrated.area_annotations = [];
        } else {
            migrated.area_annotations = migrated.area_annotations.map(a => {
                if (a.coords && (!a.area_m2 || !a.formatted_area)) {
                    const m2 = calculatePolygonArea(a.coords);
                    return { ...a, area_m2: m2, formatted_area: formatArea(m2) };
                }
                return a;
            });
        }
        
        // Migrate legacy top-level nodes if necessary
        const legacyMasked = (loadedState as any).masked_nodes;
        if (Array.isArray(legacyMasked) && migrated.polygonalization_settings.masked_nodes.length === 0) {
            migrated.polygonalization_settings.masked_nodes = legacyMasked;
        }
        const legacyForced = (loadedState as any).forced_nodes;
        if (Array.isArray(legacyForced) && migrated.polygonalization_settings.forced_nodes.length === 0) {
            migrated.polygonalization_settings.forced_nodes = legacyForced;
        }

        if (!Array.isArray(migrated.polygonalization_settings.masked_nodes)) migrated.polygonalization_settings.masked_nodes = [];
        if (!Array.isArray(migrated.polygonalization_settings.forced_nodes)) migrated.polygonalization_settings.forced_nodes = [];

        // ☁️ Cloud Sync - valeurs par défaut pour compatibilité
        if (migrated.cloud_sync_status === undefined) migrated.cloud_sync_status = 'offline';
        if (migrated.cloud_last_synced === undefined) migrated.cloud_last_synced = null;
        if (migrated.cloud_project_id === undefined) migrated.cloud_project_id = null;
        if (migrated.cloud_share_token === undefined) migrated.cloud_share_token = null;
        if (migrated.autosave_enabled === undefined) migrated.autosave_enabled = true;

        return migrated;
    }

    /**
     * Generate a human-readable project summary for display.
     */
    static exportProjectSummary(state: AppState): {
        stageCount: number;
        totalDistanceKm: number;
        segmentCount: number;
        themeId: string;
        presetId: string;
        moduleCount: number;
    } {
        const totalDist = state.routes.reduce((acc: number, r: any) => {
            const dist = r.distance_m || r.geojson?.properties?.total_distance || 0;
            return acc + dist;
        }, 0);

        const uniqueModules = new Set(
            state.polygonal_steps
                .map(s => s.assigned_module)
                .filter(Boolean)
        );

        return {
            stageCount: state.stages.length,
            totalDistanceKm: totalDist / 1000,
            segmentCount: state.polygonal_steps.length,
            themeId: state.theme_id,
            presetId: state.active_preset_id,
            moduleCount: uniqueModules.size
        };
    }

    // ─── IPC Wrappers (Electron integration) ──────────────────────────────

    /**
     * Save project via Electron IPC or browser fallback.
     */
    static async saveProject(state: AppState, filepath?: string): Promise<{ success: boolean; filepath?: string } | boolean> {
        const json = StateManager.serializeForSave(state);
        const safeTitle = (state.document_title || 'Document sans titre').trim().replace(/[/\\?%*:|"<>]/g, '_') || 'Document';
        const defaultFilename = `${safeTitle}.srdoc`;

        if (typeof window !== 'undefined' && (window as any).electronAPI?.saveScoutproj) {
            try {
                const savedPath = await (window as any).electronAPI.saveScoutproj(json, filepath, defaultFilename);
                if (!savedPath) return false;
                return { success: true, filepath: typeof savedPath === 'string' ? savedPath : filepath };
            } catch (e) {
                console.error('Failed to save via IPC:', e);
                return false;
            }
        }
        
        // Web fallback: download file
        if (typeof document !== 'undefined') {
            const blob = new Blob([json], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filepath || defaultFilename;
            a.click();
            URL.revokeObjectURL(a.href);
            return { success: true, filepath: defaultFilename };
        }

        return false;
    }

    /**
     * Load project via Electron IPC dialog or raw JSON string.
     */
    static async loadProject(jsonOrPath?: string): Promise<AppState | null> {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.openScoutproj) {
            try {
                const result = await (window as any).electronAPI.openScoutproj();
                if (!result) return null; // user cancelled
                const loaded = StateManager.deserializeFromLoad(result.state);
                if (result.filepath) {
                    loaded.current_filepath = result.filepath;
                    const baseName = result.filepath.split(/[\\/]/).pop()?.replace(/\.(srdoc|scoutproj)$/i, '');
                    if (baseName && (!loaded.document_title || loaded.document_title === 'Document sans titre')) {
                        loaded.document_title = baseName;
                    }
                }
                return loaded;
            } catch (e) {
                console.error('Failed to load via IPC:', e);
                return null;
            }
        }

        // Direct JSON string (e.g. from drag-and-drop)
        if (jsonOrPath) {
            try {
                return StateManager.deserializeFromLoad(jsonOrPath);
            } catch (e) {
                return null;
            }
        }

        // Web fallback: trigger file input
        if (typeof document !== 'undefined') {
            return new Promise((resolve) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.srdoc,.scoutproj,application/json';
                input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) {
                        resolve(null);
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        const content = re.target?.result as string;
                        try {
                            resolve(StateManager.deserializeFromLoad(content));
                        } catch (err) {
                            console.error('Failed to parse file:', err);
                            resolve(null);
                        }
                    };
                    reader.readAsText(file);
                };
                input.click();
            });
        }

        return null;
    }

    /**
     * Export HTML/PDF via Electron IPC.
     */
    static async exportFile(html: string, format: 'pdf' | 'html', outputPath: string): Promise<boolean> {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.exportFile) {
            try {
                return await (window as any).electronAPI.exportFile(html, format, outputPath);
            } catch (e) {
                console.error('Export failed:', e);
                return false;
            }
        }

        // Web fallback: open in new tab
        if (format === 'html') {
            const blob = new Blob([html], { type: 'text/html' });
            window.open(URL.createObjectURL(blob), '_blank');
            return true;
        }

        return false;
    }

    // ─── Immutable State Mutations (used by AppContext reducer) ────────────

    static addRoute(prev: AppState, route: RouteDict): AppState {
        return { ...prev, routes: [...prev.routes, route] };
    }

    static updateRoute(prev: AppState, id: string, updater: (r: RouteDict) => RouteDict): AppState {
        return { 
            ...prev, 
            routes: prev.routes.map(r => r.id === id ? updater(r) : r) 
        };
    }

    static setPolygonalSegments(prev: AppState, legKey: string, segments: PolySegment[]): AppState {
        const segsWithKey = segments.map(s => ({ ...s, leg_key: legKey }));
        return {
            ...prev,
            polygonal_legs: {
                ...prev.polygonal_legs,
                [legKey]: segsWithKey
            }
        };
    }

    static rebuildPolygonalSteps(prev: AppState): AppState {
        let steps: PolySegment[] = [];
        // Use the routes array order as the source of truth for the itinerary legs
        for (const route of prev.routes) {
            const legId = route.id;
            if (prev.polygonal_legs[legId]) {
                const mappedSegs = prev.polygonal_legs[legId].map(s => ({ ...s, leg_key: legId }));
                steps = steps.concat(mappedSegs);
            }
        }
        return { ...prev, polygonal_steps: steps };
    }
}

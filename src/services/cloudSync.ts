/**
 * cloudSync.ts — Service de synchronisation cloud pour l'éditeur existant
 * S'intègre à AppContext via dispatch, gère autosave, upload assets, sync queue
 */

import { useEffect, useRef, useCallback } from 'react';
import { useApp } from '../AppContext';
import { dispatch as appDispatch } from '../AppContext'; // Pour usage hors composant
import { authApi, assetsApi, documentsApi, exportApi, importApi, type DocumentV2, type AssetUploadResponse, ApiError } from './api';
import { saveDocumentLocal, getDocumentLocal, markDocumentSynced, markDocumentDirty, cacheAsset, getCachedAsset } from './localDB';
import { scheduleAutosave, cancelAutosave, initSyncService, processSyncQueue } from './syncService';
import { migrateSrdocToV2, exportToSrproj, importFromSrproj, type SrprojExportData } from '../logic/documentMigration';
import { generateBlockId } from '../logic/documentTypes';
import { StateManager } from '../logic/StateManager';
import { generateSelfContainedMapSvg } from '../logic/MapExportUtils';

// ─── Types ────────────────────────────────────────────────────────────────

interface CloudSyncConfig {
  documentId: string;
  getState: () => any; // AppState
  dispatch: (action: any) => void;
  autosaveInterval?: number; // ms
}

interface PendingAssetUpload {
  assetId: string;
  documentId: string;
  file: File;
  mimeType: string;
}

// ─── CloudSyncService ───────────────────────────────────────────────────

export class CloudSyncService {
  private config: CloudSyncConfig | null = null;
  private pendingAssets = new Map<string, PendingAssetUpload>();
  private isInitialized = false;
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSavedVersion = 0;

  /** Initialise le service avec la config */
  initialize(config: CloudSyncConfig) {
    this.config = config;
    this.isInitialized = true;
    initSyncService();
    this.startAutosave();
    console.log('[CloudSync] Service initialisé pour document:', config.documentId);
  }

  /** Démarre l'autosave périodique */
  private startAutosave() {
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
    const interval = this.config?.autosaveInterval || 5000; // 5s par défaut

    this.autosaveTimer = setInterval(() => {
      if (this.config && this.shouldAutosave()) {
        this.performAutosave();
      }
    }, interval);
  }

  /** Arrête l'autosave */
  destroy() {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    this.isInitialized = false;
  }

  /** Vérifie si on doit autosave (état dirty + autosave activé + connecté) */
  private shouldAutosave(): boolean {
    if (!this.config) return false;
    const state = this.config.getState();
    return state.autosave_enabled &&
           state.cloud_sync_status === 'pending' &&
           navigator.onLine &&
           authApi.isAuthenticated();
  }

  /** Effectue l'autosave vers le cloud */
  private async performAutosave() {
    if (!this.config) return;

    const state = this.config.getState();
    if (state.version === this.lastSavedVersion) return; // Pas de changement

    try {
      this.config.dispatch({ type: 'SET_CLOUD_SYNC_STATUS', status: 'pending' });

      // Construire le document V2 depuis l'état actuel (async pour pré-rendre les cartes)
      const document = await this.buildDocumentV2(state);

      // Sauvegarder localement d'abord
      await saveDocumentLocal(document);

      // Puis sauvegarder vers le cloud
      if (state.cloud_project_id && authApi.isAuthenticated() && navigator.onLine) {
        try {
          const saved = await documentsApi.update(document.id, document, document.version - 1);
          await markDocumentSynced(document.id, saved.version);
          this.lastSavedVersion = saved.version;
          this.config.dispatch({
            type: 'SET_CLOUD_SYNC_STATUS',
            status: 'synced',
            lastSynced: Date.now()
          });
          console.log('[CloudSync] Autosave réussi, version:', saved.version);
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            // Conflit - recharger depuis le cloud
            const cloudDoc = await documentsApi.get(document.id);
            this.config.dispatch({ type: 'LOAD_PROJECT', state: this.mergeCloudState(state, cloudDoc) });
          }
          throw err;
        }
      } else {
        // Hors ligne ou pas de projet cloud - juste marquer dirty local
        await markDocumentDirty(document.id);
        this.config.dispatch({ type: 'SET_CLOUD_SYNC_STATUS', status: 'pending' });
      }
    } catch (err) {
      console.error('[CloudSync] Erreur autosave:', err);
      this.config.dispatch({ type: 'SET_CLOUD_SYNC_STATUS', status: 'error' });
    }
  }

  /** Construit un DocumentV2 depuis l'AppState actuel (async pour pré-rendre les cartes) */
  private async buildDocumentV2(state: any): Promise<DocumentV2> {
    const now = new Date().toISOString();
    const docId = state.cloud_project_id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Extraire les assets de base (polices, etc.)
    const assets = this.extractAssetsFromState(state);

    // Pré-rendre les cartes pour les blocs map_snippet
    const mapAssets = await this.generateMapAssets(state);
    // Fusionner les assets de cartes
    Object.assign(assets.images, mapAssets);

    // Construire les blocs (avec assetId pour les cartes pré-rendues)
    const blocks = this.convertCarnetStepsToBlocks(state.carnet_steps, state, mapAssets);

    return {
      schemaVersion: '2.0',
      id: docId,
      title: state.document_title || 'Document sans titre',
      createdAt: now,
      updatedAt: now,
      version: state.version,
      assets,
      pageLayout: {
        format: 'A4',
        orientation: 'portrait',
        margins: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
        header: { enabled: true, left: 'Troupe 1ère Port-Marly', right: '{{document.title}}', fontSize: '8pt', color: '#666666' },
        footer: { enabled: true, center: 'Page {{page}} / {{pages}}', fontSize: '8pt', color: '#999999' },
        backgroundColor: '#ffffff'
      },
      blocks,
      settings: {
        autoSave: state.autosave_enabled,
        autoSaveInterval: 5000,
        spellCheck: true,
        showInvisibles: false,
        defaultFontFamily: 'system-ui',
        defaultFontSize: '11pt',
        theme: 'system'
      }
    };
  }

  /** Génère les SVG de cartes autonomes (tuiles en base64) pour chaque map_snippet */
  private async generateMapAssets(state: any): Promise<Record<string, any>> {
    const mapAssets: Record<string, any> = {};
    let imgCounter = 0;

    // Récupérer les clés API depuis l'état
    const apiKeys = {
      ign: state.ign_api_key,
      mapy: state.mapy_api_key
    };

    for (const step of state.carnet_steps || []) {
      if (!['carte_ign', 'carte_simple', 'drapeaux'].includes(step.moduleId)) continue;
      if (!step.coords?.length) continue;

      const assetId = `map_${step.id}`;
      const imgKey = `img_${++imgCounter}`;

      const latLngs = step.coords.map((c: any) => [c[1], c[0]] as [number, number]);
      const center = step.mapPersist?.center || step.mapCenter || [48.85, 2.35];
      const zoom = step.mapPersist?.zoom || step.mapZoom || 15;
      const width = step.mapPersist?.width || 800;
      const height = step.mapPersist?.height || 600;
      const layerId = step.mapPersist?.layerId || 'PLAN.IGN';
      const scaleName = step.mapPersist?.scaleName || '1:25000';
      const showRoute = step.mapPersist?.showRoute ?? true;
      const showEndpoints = step.mapPersist?.showEndpoints ?? true;
      const showAnnotations = step.mapPersist?.showAnnotations ?? true;

      try {
        // Générer le SVG autonome avec tuiles en base64
        const { svg, formattedScale } = await generateSelfContainedMapSvg({
          latLngs,
          center,
          zoom,
          width,
          height,
          layerId,
          scaleName,
          showRoute,
          showEndpoints,
          showAnnotations,
          pointAnnotations: state.point_annotations,
          areaAnnotations: state.area_annotations,
          apiKeys
        });

        // Stocker le SVG comme data URI base64
        const svgBase64 = btoa(unescape(encodeURIComponent(svg)));
        const dataUri = `data:image/svg+xml;base64,${svgBase64}`;

        mapAssets[imgKey] = {
          assetId,
          path: `assets/images/${assetId}.svg`,
          width,
          height,
          mimeType: 'image/svg+xml',
          base64: svgBase64, // SVG complet en base64
          dataUri, // Data URI prête à l'emploi
          formattedScale
        };

        console.log(`[CloudSync] Carte pré-rendue pour ${step.id}: ${formattedScale}, ${svg.length} chars`);
      } catch (err) {
        console.warn(`[CloudSync] Échec pré-rendu carte pour ${step.id}:`, err);
        // Fallback: asset sans données (le backend fera un placeholder)
        mapAssets[imgKey] = {
          assetId,
          path: `assets/images/${assetId}.svg`,
          width,
          height,
          mimeType: 'image/svg+xml'
        };
      }
    }

    return mapAssets;
  }

  /** Extrait les assets (polices, images) depuis l'état */
  private extractAssetsFromState(state: any): { fonts: any[]; images: Record<string, any> } {
    const fonts: any[] = [];
    const images: Record<string, any> = {};

    // Polices utilisées par les modules de chiffrement
    const usedModules = new Set(state.carnet_steps?.map((s: any) => s.moduleId).filter(Boolean) || []);
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

    // Images des cartes
    let imgCounter = 0;
    state.carnet_steps?.forEach((step: any) => {
      if (['carte_ign', 'carte_simple', 'drapeaux'].includes(step.moduleId) && step.coords?.length) {
        const assetId = `map_${step.id}`;
        const imgKey = `img_${++imgCounter}`;
        images[imgKey] = {
          assetId,
          path: `assets/images/${assetId}.webp`,
          width: step.mapPersist?.width || 800,
          height: step.mapPersist?.height || 600,
          mimeType: 'image/webp'
        };
      }
    });

    return { fonts, images };
  }

  /** Convertit carnet_steps en blocks V2 */
  private convertCarnetStepsToBlocks(steps: any[], state: any, mapAssets: Record<string, any>): any[] {
    const blocks: any[] = [];
    let order = 0;
    let mapImgIndex = 0;

    // Page de garde
    const titleStep = steps?.find((s: any) => s.isTitleStep);
    if (titleStep) {
      blocks.push({
        id: generateBlockId(),
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
    }

    // Étapes du carnet
    steps?.forEach((step: any) => {
      if (step.isTitleStep) return;

      if (step.isManual) {
        // Bloc manuel
        if (step.manualType === 'html') {
          blocks.push({
            id: step.id || generateBlockId(),
            type: 'rich_text',
            locked: false,
            autoUpdate: false,
            dependsOn: [],
            order: order++,
            content: [{ type: 'paragraph', text: step.solutionText || '' }]
          });
        }
      } else {
        // Bloc calculé (chiffré, carte, etc.)
        if (['morse', 'vigenere', 'polybe', 'templier', 'maritime', 'avocat', 'cassis'].includes(step.moduleId)) {
          blocks.push({
            id: step.id || generateBlockId(),
            type: 'crypto_block',
            locked: true,
            autoUpdate: true,
            dependsOn: step.segmentIndices?.map((i: number) => `segment_${i}`) || [],
            order: order++,
            config: {
              cipher: step.moduleId,
              key: step.moduleId === 'vigenere' ? require('../logic/ThemeManager').themeManager.getTheme(state.theme_id).vigenere_key : undefined,
              sourceText: step.solutionText || '',
              renderedText: step.encodedText || step.solutionText || '',
              autoRegenerate: true
            }
          });
        } else if (['carte_ign', 'carte_simple', 'drapeaux'].includes(step.moduleId)) {
          mapImgIndex++;
          const assetId = `map_${step.id}`;
          // Trouver la clé d'image correspondante
          const imgKey = Object.keys(mapAssets).find(k => mapAssets[k].assetId === assetId);

          blocks.push({
            id: step.id || generateBlockId(),
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
              routeCoords: step.coords?.map((c: any) => [c[1], c[0]]),
              assetId: imgKey // Référence à l'asset pré-rendu
            }
          });
        }
      }
    });

    return blocks;
  }

  /** Fusionne l'état local avec l'état cloud (résolution conflit) */
  private mergeCloudState(localState: any, cloudDoc: DocumentV2): any {
    // Stratégie : cloud gagne pour le contenu, local garde les préférences UI
    return {
      ...localState,
      ...StateManager.deserializeFromLoad(JSON.stringify(cloudDoc)),
      // Garder les prefs UI locales
      active_mode: localState.active_mode,
      active_tool: localState.active_tool,
      selected_layer_id: localState.selected_layer_id,
      theme_id: localState.theme_id,
      // Cloud gagne pour le contenu
      carnet_steps: this.convertDocumentBlocksToCarnetSteps(cloudDoc.blocks),
      cloud_project_id: cloudDoc.id,
      version: cloudDoc.version
    };
  }

  /** Convertit blocks V2 vers carnet_steps (simplifié) */
  private convertDocumentBlocksToCarnetSteps(blocks: any[]): any[] {
    // Implémentation simplifiée - à étendre selon besoins
    return blocks.filter(b => b.type !== 'title_page' && b.type !== 'page_break' && b.type !== 'annexe')
      .map((block, i) => ({
        id: block.id,
        fromLabel: '',
        toLabel: '',
        moduleId: block.type === 'crypto_block' ? block.config.cipher :
                   block.type === 'map_snippet' ? 'carte_ign' : 'texte_clair',
        distanceM: 0,
        azimuth: 0,
        coords: block.config.routeCoords || [],
        solutionText: block.config.sourceText || block.content?.[0]?.text || '',
        encodedText: block.config.renderedText || block.config.sourceText || '',
        warnings: [],
        isManual: block.type === 'rich_text',
        segmentIndices: block.dependsOn?.map((d: string) => parseInt(d.replace('segment_', ''))) || [],
        isEdited: false
      }));
  }

  /** Upload un asset (image, police) vers S3 */
  async uploadAsset(file: File, documentId: string): Promise<AssetUploadResponse> {
    // Optimisation image côté client
    let blob = file;
    let mimeType = file.type;

    if (file.type.startsWith('image/') && file.size > 50000) {
      blob = await this.optimizeImage(file);
      mimeType = 'image/webp';
    }

    const assetId = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Cache local
    await cacheAsset(assetId, documentId, blob, mimeType);

    // Upload cloud si connecté
    if (authApi.isAuthenticated() && navigator.onLine) {
      try {
        return await assetsApi.upload(new File([blob], assetId, { type: mimeType }), documentId);
      } catch (err) {
        console.warn('[CloudSync] Upload asset échoué, sera retry:', err);
        return { assetId, url: URL.createObjectURL(blob), mimeType, size: blob.size };
      }
    }

    return { assetId, url: URL.createObjectURL(blob), mimeType, size: blob.size };
  }

  /** Optimisation image via canvas */
  private optimizeImage(file: File): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const maxDim = 1920;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width *= ratio;
          height *= ratio;
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((b) => resolve(b!), 'image/webp', 0.85);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  /** Force une sauvegarde immédiate (bouton Save) */
  async forceSave() {
    if (!this.config) return;
    await this.performAutosave();
  }

  /** Exporte en PDF via backend */
  async exportPdf(version: 'participant' | 'solution' | 'both' = 'participant') {
    if (!this.config) return;
    const state = this.config.getState();
    if (!state.cloud_project_id) throw new Error('Projet non sauvegardé dans le cloud');

    const blob = await exportApi.exportPdf(state.cloud_project_id, { format: 'pdf', version, includeAnnexes: true });
    return blob;
  }

  /** Exporte en archive .srproj */
  async exportSrproj() {
    if (!this.config) return;
    const state = this.config.getState();

    const document = await this.buildDocumentV2(state);
    const assetBlobs = new Map<string, Blob>();

    // Récupérer les assets depuis le cache local
    for (const font of document.assets.fonts) {
      if (font.assetId) {
        const blob = await getCachedAsset(font.assetId);
        if (blob) assetBlobs.set(font.assetId, blob);
      }
    }
    for (const img of Object.values(document.assets.images)) {
      const blob = await getCachedAsset(img.assetId);
      if (blob) assetBlobs.set(img.assetId, blob);
    }

    const exportData: SrprojExportData = { manifest: document, assetBlobs };
    const zipData = await exportToSrproj(exportData);
    return zipData;
  }

  /** Importe une archive .srproj */
  async importSrproj(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const { manifest, assetBlobs } = await importFromSrproj(new Uint8Array(arrayBuffer));

    // Sauvegarder localement
    await saveDocumentLocal(manifest);

    // Upload assets vers cloud si connecté (via backend API)
    if (authApi.isAuthenticated() && navigator.onLine) {
      for (const [assetId, blob] of assetBlobs) {
        try {
          const file = new File([blob], assetId, { type: blob.type });
          await assetsApi.upload(file, manifest.id);
        } catch (err) {
          console.warn('[CloudSync] Upload asset import échoué:', err);
        }
      }
    }

    return manifest;
  }

  /** Migre un ancien .srdoc vers le nouveau format */
  async migrateSrdoc(file: File) {
    const text = await file.text();
    const oldState = JSON.parse(text);
    const { document } = await migrateSrdocToV2(oldState);
    await saveDocumentLocal(document);
    return document;
  }
}

// Instance singleton
export const cloudSync = new CloudSyncService();

/** Hook React pour utiliser le service dans les composants */
export function useCloudSync(documentId: string) {
  const { state, dispatch } = useApp();
  const serviceRef = useRef<CloudSyncService>(cloudSync);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && state.cloud_project_id === documentId) {
      serviceRef.current.initialize({
        documentId,
        getState: () => state,
        dispatch,
        autosaveInterval: 5000
      });
      initializedRef.current = true;
    }

    return () => {
      if (initializedRef.current) {
        serviceRef.current.destroy();
        initializedRef.current = false;
      }
    };
  }, [documentId, state.cloud_project_id]);

  return {
    forceSave: () => serviceRef.current.forceSave(),
    exportPdf: (version?: 'participant' | 'solution' | 'both') => serviceRef.current.exportPdf(version),
    exportSrproj: () => serviceRef.current.exportSrproj(),
    importSrproj: (file: File) => serviceRef.current.importSrproj(file),
    migrateSrdoc: (file: File) => serviceRef.current.migrateSrdoc(file),
    uploadAsset: (file: File) => serviceRef.current.uploadAsset(file, documentId),
    syncStatus: state.cloud_sync_status,
    lastSynced: state.cloud_last_synced,
    isAuthenticated: authApi.isAuthenticated()
  };
}
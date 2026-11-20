/**
 * documentMigration.ts — Migration .srdoc v5 → .srproj v2
 * Convertit l'ancien AppState (JSON pur) vers le nouveau DocumentV2 (ZIP + manifest)
 */

import type { AppState, CarnetStep, Stage, RouteDict, PolySegment, PointAnnotation, AreaAnnotation, Itinerary } from './types';
import type { DocumentV2, DocumentBlock, BlockType, RichTextContent, DocumentAssets, FontAsset, ImageAsset, PageLayout, CryptoBlockConfig, MapSnippetConfig, ElevationProfileConfig, RouteTableConfig, AnnexeConfig, TitlePageConfig } from './documentTypes';
import { ModuleLogic } from './ModuleLogic';
import { themeManager } from './ThemeManager';
import { generateBlockId, generateAssetId, createDefaultPageLayout, createDefaultDocumentSettings } from './documentTypes';

// ─── Mapping modules → types de blocs ────────────────────────────────────

const MODULE_TO_BLOCK_TYPE: Record<string, BlockType> = {
  'morse': 'crypto_block',
  'vigenere': 'crypto_block',
  'polybe': 'crypto_block',
  'templier': 'crypto_block',
  'maritime': 'crypto_block',
  'avocat': 'crypto_block',
  'cassis': 'crypto_block',
  'carte_ign': 'map_snippet',
  'carte_simple': 'map_snippet',
  'drapeaux': 'map_snippet',
  'gilwell': 'rich_text',      // Rendu SVG inline
  'texte_clair': 'rich_text',
};

const CRYPTO_MODULES = new Set(['morse', 'vigenere', 'polybe', 'templier', 'maritime', 'avocat', 'cassis']);
const MAP_MODULES = new Set(['carte_ign', 'carte_simple', 'drapeaux']);

// ─── Migration principale ────────────────────────────────────────────────

export interface MigrationResult {
  document: DocumentV2;
  assets: Map<string, { blob: Blob; mimeType: string; assetId: string; suggestedPath: string }>;
  warnings: string[];
}

export async function migrateSrdocToV2(
  oldState: AppState,
  options: {
    documentId?: string;
    title?: string;
    loadAssetBlobs?: (assetIds: string[]) => Promise<Map<string, Blob>>;
  } = {}
): Promise<MigrationResult> {
  const warnings: string[] = [];
  const documentId = options.documentId || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const title = options.title || oldState.document_title || 'Document sans titre';

  // 1. Extraire les assets (polices, images) depuis l'ancien état
  const { assets, warnings: assetWarnings } = await extractAssets(oldState, options.loadAssetBlobs);
  warnings.push(...assetWarnings);

  // 2. Construire la mise en page depuis les préférences/etat
  const pageLayout = buildPageLayout(oldState);

  // 3. Convertir carnet_steps → blocks[]
  const { blocks, warnings: blockWarnings } = buildBlocksFromCarnet(oldState, assets);
  warnings.push(...blockWarnings);

  // 4. Détecter les modules utilisés pour les annexes
  const usedModules = detectUsedModules(oldState);
  const annexeBlocks = buildAnnexeBlocks(usedModules, oldState);
  blocks.push(...annexeBlocks);

  // 5. Ajouter blocs spéciaux (profil altimétrique, table itinéraire, page de garde)
  const specialBlocks = buildSpecialBlocks(oldState, assets);
  blocks.push(...specialBlocks);

  // Trier par ordre
  blocks.sort((a, b) => a.order - b.order);

  // 6. Construire le document final
  const now = new Date().toISOString();
  const document: DocumentV2 = {
    schemaVersion: "2.0",
    id: documentId,
    title,
    createdAt: now,
    updatedAt: now,
    version: 1,
    assets,
    pageLayout,
    blocks,
    settings: createDefaultDocumentSettings()
  };

  return { document, assets: new Map(), warnings }; // assets Map vide car on retourne déjà dans document.assets
}

// ─── Extraction des assets ──────────────────────────────────────────────

async function extractAssets(
  state: AppState,
  loadBlobs?: (ids: string[]) => Promise<Map<string, Blob>>
): Promise<{ assets: DocumentAssets; warnings: string[] }> {
  const warnings: string[] = [];
  const fonts: FontAsset[] = [];
  const images: Record<string, ImageAsset> = {};

  // Polices connues utilisées par l'app
  const knownFonts = [
    { id: 'font_morse', family: 'Morse', weight: 400, assetId: 'fonts/morse.woff2', path: 'assets/fonts/morse.woff2', mimeType: 'font/woff2' },
    { id: 'font_templier', family: 'TemplarsCipherPlus', weight: 400, assetId: 'fonts/templier.woff2', path: 'assets/fonts/templier.woff2', mimeType: 'font/woff2' },
    { id: 'font_maritime', family: 'Maritime', weight: 400, assetId: 'fonts/maritime.woff2', path: 'assets/fonts/maritime.woff2', mimeType: 'font/woff2' },
    { id: 'font_gilwell', family: 'Kalam', weight: 400, assetId: 'fonts/gilwell.woff2', path: 'assets/fonts/gilwell.woff2', mimeType: 'font/woff2' },
  ];

  // Ajouter les polices utilisées dans le document
  const usedModules = detectUsedModules(state);
  for (const mod of usedModules) {
    const font = knownFonts.find(f => f.id.includes(mod));
    if (font && !fonts.some(f => f.id === font.id)) {
      fonts.push(font);
    }
  }

  // Police par défaut toujours incluse
  if (!fonts.some(f => f.family === 'system-ui')) {
    fonts.unshift({
      id: 'font_default',
      family: 'system-ui',
      weight: 400,
      assetId: '',
      path: '',
      mimeType: ''
    });
  }

  // Images : extraites depuis les étapes cartographiques (carte_ign, drapeaux)
  let imgCounter = 0;
  for (const step of state.carnet_steps || []) {
    if (MAP_MODULES.has(step.moduleId) && step.coords && step.coords.length > 0) {
      // Générer un assetId pour la carte statique
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
  }

  // Images depuis annotations (point_annotations avec icônes custom, etc.)
  // Note: les images d'annotations sont généralement des icônes SVG, pas des assets binaires

  return {
    assets: { fonts, images },
    warnings
  };
}

// ─── Construction de la mise en page ────────────────────────────────────

function buildPageLayout(state: AppState): PageLayout {
  const layout = createDefaultPageLayout();

  // Personnaliser depuis le thème ou préférences
  const theme = themeManager.getTheme(state.theme_id);
  if (theme) {
    // Peut-être extraire des configs de mise en page du thème
  }

  // Si carnet_include_general_map → ajouter en header
  if (state.carnet_include_general_map) {
    layout.header.center = layout.header.center || 'Carte générale incluse';
  }

  return layout;
}

// ─── Détection modules utilisés ──────────────────────────────────────────

function detectUsedModules(state: AppState): string[] {
  const modules = new Set<string>();
  for (const step of state.carnet_steps || []) {
    if (step.moduleId) modules.add(step.moduleId);
    if (step.inlineManualSteps) {
      for (const inline of Object.values(step.inlineManualSteps)) {
        if (inline.moduleId) modules.add(inline.moduleId);
      }
    }
  }
  return Array.from(modules);
}

// ─── Conversion carnet_steps → blocks ────────────────────────────────────

interface BuildBlocksResult {
  blocks: DocumentBlock[];
  warnings: string[];
}

function buildBlocksFromCarnet(state: AppState, assets: DocumentAssets): BuildBlocksResult {
  const blocks: DocumentBlock[] = [];
  const warnings: string[] = [];
  let order = 0;

  const steps = state.carnet_steps || [];
  const polygonalSteps = state.polygonal_steps || [];
  const stages = state.stages || [];

  // 1. Page de garde (toujours en premier)
  const titleStep = steps.find(s => s.isTitleStep);
  if (titleStep) {
    blocks.push(buildTitlePageBlock(titleStep, order++));
  } else {
    // Page de garde par défaut
    blocks.push(buildDefaultTitlePage(state, order++));
  }

  // 2. Parcourir les étapes du carnet
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.isTitleStep) continue; // Déjà géré

    if (step.isManual) {
      // Bloc manuel (commentaire ou code saisi à la main)
      const manualBlocks = buildManualStepBlocks(step, order);
      blocks.push(...manualBlocks);
      order += manualBlocks.length;
    } else {
      // Bloc calculé (généré depuis l'itinéraire)
      const computedBlocks = buildComputedStepBlocks(step, polygonalSteps, stages, order, state);
      blocks.push(...computedBlocks);
      order += computedBlocks.length;
    }
  }

  // 3. Marqueur d'arrivée final
  if (steps.length > 0) {
    const lastStep = steps[steps.length - 1];
    if (!lastStep.isManual && lastStep.toLabel) {
      blocks.push(buildArrivalMarkerBlock(lastStep, order++));
    }
  }

  return { blocks, warnings };
}

function buildTitlePageBlock(step: CarnetStep, order: number): DocumentBlock {
  const config: TitlePageConfig = {
    title: step.solutionText?.replace(/<[^>]+>/g, '').trim() || 'Carnet de Raid',
    subtitle: `Raid du ${new Date().toLocaleDateString('fr-FR')}`,
    author: 'ScoutRaider',
    date: new Date().toISOString().split('T')[0]
  };

  return {
    id: generateBlockId(),
    type: 'title_page',
    locked: false,
    autoUpdate: false,
    dependsOn: [],
    order,
    config
  };
}

function buildDefaultTitlePage(state: AppState, order: number): DocumentBlock {
  const config: TitlePageConfig = {
    title: state.document_title || 'Carnet de Raid',
    subtitle: `Raid du ${new Date().toLocaleDateString('fr-FR')}`,
    author: 'ScoutRaider',
    date: new Date().toISOString().split('T')[0]
  };

  return {
    id: generateBlockId(),
    type: 'title_page',
    locked: false,
    autoUpdate: false,
    dependsOn: [],
    order,
    config
  };
}

function buildManualStepBlocks(step: CarnetStep, baseOrder: number): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];

  if (step.manualType === 'html') {
    // Bloc texte riche HTML
    const content: RichTextContent[] = [{
      type: 'paragraph',
      text: step.solutionText || ''
    }];

    blocks.push({
      id: step.id || generateBlockId(),
      type: 'rich_text',
      locked: false,
      autoUpdate: false,
      dependsOn: [],
      order: baseOrder,
      content
    });
  } else if (step.manualType === 'code') {
    // Bloc code manuel (chiffrement saisi à la main)
    const config: CryptoBlockConfig = {
      cipher: step.moduleId as CryptoBlockConfig['cipher'] || 'vigenere',
      key: themeManager.getTheme().vigenere_key,
      sourceText: step.solutionText || '',
      renderedText: step.encodedText || step.solutionText || '',
      autoRegenerate: false
    };

    blocks.push({
      id: step.id || generateBlockId(),
      type: 'crypto_block',
      locked: false,
      autoUpdate: false,
      dependsOn: [],
      order: baseOrder,
      config
    });
  }

  return blocks;
}

function buildComputedStepBlocks(
  step: CarnetStep,
  polygonalSteps: PolySegment[],
  stages: Stage[],
  baseOrder: number,
  state: AppState
): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];

  // Déterminer le type de bloc selon le module
  const blockType = MODULE_TO_BLOCK_TYPE[step.moduleId] || 'rich_text';

  // Marqueur d'étape (A, B, C...) si premier segment
  const isFirstSegment = step.segmentIndices && step.segmentIndices[0] === 0;
  const stageLabel = step.fromLabel || (isFirstSegment ? stages[0]?.label : '');

  if (stageLabel && isFirstSegment) {
    blocks.push(buildStageMarkerBlock(stageLabel, baseOrder++));
  }

  if (CRYPTO_MODULES.has(step.moduleId)) {
    // Bloc chiffré
    const config: CryptoBlockConfig = {
      cipher: step.moduleId as CryptoBlockConfig['cipher'],
      key: themeManager.getTheme().vigenere_key,
      sourceText: step.solutionText || '',
      renderedText: step.encodedText || step.solutionText || '',
      autoRegenerate: true
    };

    blocks.push({
      id: step.id || generateBlockId(),
      type: 'crypto_block',
      locked: true,           // Protégé : généré automatiquement
      autoUpdate: true,       // Recalculé si l'itinéraire change
      dependsOn: step.segmentIndices?.map(i => `segment_${i}`) || [],
      order: baseOrder++,
      config,
      renderedText: step.encodedText
    });
  } else if (MAP_MODULES.has(step.moduleId)) {
    // Extrait de carte
    const latLngs = (step.coords || []).map(c => [c[1], c[0]] as [number, number]);
    const midPoint = latLngs.length > 0 ? latLngs[Math.floor(latLngs.length / 2)] : [48.85, 2.35] as [number, number];

    const config: MapSnippetConfig = {
      center: step.mapPersist?.center || step.mapCenter || midPoint,
      zoom: step.mapPersist?.zoom || step.mapZoom || 15,
      width: step.mapPersist?.width || 800,
      height: step.mapPersist?.height || 600,
      scaleName: step.mapPersist?.scaleName || '1:25000',
      layerId: step.mapPersist?.layerId || 'PLAN.IGN',
      showRoute: step.mapPersist?.showRoute ?? true,
      showEndpoints: step.mapPersist?.showEndpoints ?? true,
      showAnnotations: step.mapPersist?.showAnnotations ?? true,
      routeCoords: latLngs
    };

    blocks.push({
      id: step.id || generateBlockId(),
      type: 'map_snippet',
      locked: true,
      autoUpdate: step.mapPersist?.isLocked ? false : true,
      dependsOn: step.segmentIndices?.map(i => `segment_${i}`) || [],
      order: baseOrder++,
      config
    });
  } else if (step.moduleId === 'gilwell' && step.gilwellSvg) {
    // SVG Gilwell inline
    const content: RichTextContent[] = [{
      type: 'code_block',
      text: step.gilwellSvg,
      language: 'svg'
    }];

    blocks.push({
      id: step.id || generateBlockId(),
      type: 'rich_text',
      locked: true,
      autoUpdate: true,
      dependsOn: step.segmentIndices?.map(i => `segment_${i}`) || [],
      order: baseOrder++,
      content
    });
  } else {
    // Texte riche par défaut (texte_clair, etc.)
    const content: RichTextContent[] = [{
      type: 'paragraph',
      text: step.solutionText || ''
    }];

    blocks.push({
      id: step.id || generateBlockId(),
      type: 'rich_text',
      locked: true,
      autoUpdate: true,
      dependsOn: step.segmentIndices?.map(i => `segment_${i}`) || [],
      order: baseOrder++,
      content
    });
  }

  // Étapes manuelles inline (commentaires insérés entre segments)
  if (step.inlineManualSteps) {
    for (const [segIdx, inlineStep] of Object.entries(step.inlineManualSteps)) {
      const inlineBlocks = buildManualStepBlocks(inlineStep, baseOrder);
      blocks.push(...inlineBlocks);
      baseOrder += inlineBlocks.length;
    }
  }

  return blocks;
}

function buildStageMarkerBlock(label: string, order: number): DocumentBlock {
  const content: RichTextContent[] = [{
    type: 'heading',
    level: 1,
    text: `Étape ${label}`,
    align: 'center'
  }];

  return {
    id: generateBlockId(),
    type: 'rich_text',
    locked: false,
    autoUpdate: false,
    dependsOn: [],
    order,
    content
  };
}

function buildArrivalMarkerBlock(step: CarnetStep, order: number): DocumentBlock {
  const content: RichTextContent[] = [{
    type: 'heading',
    level: 2,
    text: `Arrivée : Étape ${step.toLabel}`,
    align: 'center'
  }, {
    type: 'paragraph',
    text: `Fin du raid — Distance totale : ${step.distanceM}m`
  }];

  return {
    id: generateBlockId(),
    type: 'rich_text',
    locked: false,
    autoUpdate: false,
    dependsOn: [],
    order,
    content
  };
}

// ─── Blocs annexes (tables de décodage) ────────────────────────────────

function buildAnnexeBlocks(usedModules: string[], state: AppState): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  let order = 1000; // Après le contenu principal
  const disabledAnnexes = new Set(state.disabled_annexes || []);

  const moduleToAnnexe: Record<string, AnnexeConfig['type']> = {
    'morse': 'morse',
    'polybe': 'polybe',
    'vigenere': 'vigenere',
    'maritime': 'maritime',
    'templier': 'templier',
    'avocat': 'avocat'
  };

  for (const mod of usedModules) {
    const annexeType = moduleToAnnexe[mod];
    if (!annexeType) continue;

    const annexeId = `annexe_${annexeType}` as any;
    if (disabledAnnexes.has(annexeId)) continue;

    let config: AnnexeConfig;

    switch (annexeType) {
      case 'morse':
        config = {
          type: 'morse',
          title: 'Table Morse International',
          content: buildMorseTableHtml()
        };
        break;
      case 'polybe':
        config = {
          type: 'polybe',
          title: 'Carré de Polybe',
          content: buildPolybeTableHtml()
        };
        break;
      case 'vigenere':
        config = {
          type: 'vigenere',
          title: `Table de Vigenère (Clé : ${themeManager.getTheme().vigenere_key})`,
          content: buildVigenereTableHtml(themeManager.getTheme().vigenere_key)
        };
        break;
      case 'maritime':
        config = {
          type: 'maritime',
          title: 'Code Maritime & Pavillons NATO',
          content: buildMaritimeTableHtml()
        };
        break;
      case 'templier':
        config = {
          type: 'templier',
          title: 'Croix Templière',
          content: buildTemplierTableHtml()
        };
        break;
      case 'avocat':
        config = {
          type: 'avocat',
          title: 'Méthode Avocat (A=K / Décalage +10)',
          content: buildAvocatTableHtml()
        };
        break;
      default:
        continue;
    }

    blocks.push({
      id: generateBlockId(),
      type: 'annexe',
      locked: true,
      autoUpdate: false,
      dependsOn: [],
      order: order++,
      config
    });
  }

  return blocks;
}

function buildMorseTableHtml(): string {
  const table = ModuleLogic.getMorseTable();
  let html = '<table class="morse-table"><thead><tr><th>Caractère</th><th>Code</th></tr></thead><tbody>';
  for (const [char, code] of Object.entries(table)) {
    html += `<tr><td><strong>${char.toUpperCase()}</strong></td><td><code>${code}</code></td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function buildPolybeTableHtml(): string {
  const grid = ModuleLogic.getPolybeGrid();
  let html = '<table class="polybe-table"><thead><tr><th></th>';
  for (let c = 1; c <= 6; c++) html += `<th>${c}</th>`;
  html += '</tr></thead><tbody>';
  for (let r = 0; r < 6; r++) {
    html += `<tr><th>${r + 1}</th>`;
    for (let c = 0; c < 6; c++) {
      html += `<td><strong>${grid[r][c].char}</strong><br><small>${grid[r][c].coord}</small></td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function buildVigenereTableHtml(key: string): string {
  const { alphabet, table } = ModuleLogic.getVigenereTable(key);
  let html = `<table class="vigenere-table"><caption>Clé : ${key}</caption><thead><tr><th></th>`;
  for (const c of alphabet) html += `<th>${c}</th>`;
  html += '</tr></thead><tbody>';
  for (let i = 0; i < table.length; i++) {
    html += `<tr><th>${alphabet[i]}</th>`;
    for (const c of table[i]) html += `<td>${c}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function buildMaritimeTableHtml(): string {
  const nato = ModuleLogic.getNATOAlphabet();
  let html = '<table class="maritime-table"><thead><tr><th>Lettre</th><th>Mot-code</th></tr></thead><tbody>';
  for (const [char, word] of Object.entries(nato)) {
    html += `<tr><td><strong>${char.toUpperCase()}</strong></td><td>${word}</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function buildTemplierTableHtml(): string {
  // Image référence pour le code templier
  return '<p>Voir l\'image de référence du code templier (symbole pigpen).</p>';
}

function buildAvocatTableHtml(): string {
  let html = '<table class="avocat-table"><thead><tr><th>Clair</th><th>Chiffré</th></tr></thead><tbody>';
  const plain = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const cipher = 'KLMNOPQRSTUVWXYZABCDEFGHIJ';
  for (let i = 0; i < 26; i++) {
    html += `<tr><td>${plain[i]}</td><td>${cipher[i]}</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

// ─── Blocs spéciaux (profil altimétrique, tableau itinéraire) ──────────

function buildSpecialBlocks(state: AppState, assets: DocumentAssets): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  let order = 2000;

  // Profil altimétrique
  if (state.carnet_include_elevation_profile && state.routes.length > 0) {
    // Le SVG sera généré à l'export, ici on crée juste le bloc placeholder
    blocks.push({
      id: generateBlockId(),
      type: 'elevation_profile',
      locked: true,
      autoUpdate: true,
      dependsOn: ['routes'],
      order: order++,
      config: {
        svg: '', // Sera rempli à l'export
        stats: { ascend_m: 0, descend_m: 0, min_alt_m: 0, max_alt_m: 0, duration_min: 0 },
        width: 720,
        height: 160
      } as ElevationProfileConfig
    });
  }

  // Tableau récapitulatif itinéraire
  if (state.polygonal_steps.length > 0) {
    const rows: RouteTableConfig['rows'] = [];
    let cumulative = 0;
    const processedLegs = new Set<string>();

    for (const step of state.carnet_steps || []) {
      if (step.isManual) continue;
      for (const segIdx of step.segmentIndices || []) {
        const seg = state.polygonal_steps[segIdx];
        if (!seg) continue;

        const legKey = seg.leg_key || '';
        const isNewLeg = !processedLegs.has(legKey);
        if (isNewLeg) processedLegs.add(legKey);

        const fromStage = isNewLeg ? state.stages[processedLegs.size - 1] : null;
        const stepLabel = isNewLeg && fromStage ? `${fromStage.label} → ${String.fromCharCode(65 + processedLegs.size)}` : '';

        cumulative += seg.distance || 0;
        rows.push({
          step: stepLabel,
          azimuth: seg.azimut || 0,
          distance: seg.distance || 0,
          module: step.moduleId,
          pois: step.pois?.filter(p => p.selected).map(p => p.name) || [],
          cumulative
        });
      }
    }

    if (rows.length > 0) {
      blocks.push({
        id: generateBlockId(),
        type: 'route_table',
        locked: true,
        autoUpdate: true,
        dependsOn: ['routes', 'assignments'],
        order: order++,
        config: {
          columns: ['step', 'azimuth', 'distance', 'module', 'pois', 'cumulative'],
          rows
        } as RouteTableConfig
      });
    }
  }

  return blocks;
}

// ─── Export .srproj (ZIP) ──────────────────────────────────────────────

import { zipSync, strToU8 } from 'fflate';

export interface SrprojExportData {
  manifest: DocumentV2;
  assetBlobs: Map<string, Blob>; // assetId -> blob
}

export async function exportToSrproj(data: SrprojExportData): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};

  // 1. Manifest JSON
  files['manifest.json'] = strToU8(JSON.stringify(data.manifest, null, 2));

  // 2. Assets binaires
  for (const [assetId, blob] of data.assetBlobs) {
    const asset = findAssetInManifest(data.manifest, assetId);
    if (asset) {
      const arrayBuffer = await blob.arrayBuffer();
      files[asset.path] = new Uint8Array(arrayBuffer);
    }
  }

  // 3. Créer ZIP
  const zip = zipSync(files, { level: 6 });
  return zip;
}

function findAssetInManifest(manifest: DocumentV2, assetId: string): FontAsset | ImageAsset | null {
  for (const font of manifest.assets.fonts) {
    if (font.assetId === assetId) return font;
  }
  for (const img of Object.values(manifest.assets.images)) {
    if (img.assetId === assetId) return img;
  }
  return null;
}

// ─── Import .srproj ────────────────────────────────────────────────────

import { unzipSync } from 'fflate';

export interface SrprojImportResult {
  manifest: DocumentV2;
  assetBlobs: Map<string, Blob>;
}

export async function importFromSrproj(zipData: Uint8Array): Promise<SrprojImportResult> {
  const unzipped = unzipSync(zipData);
  const assetBlobs = new Map<string, Blob>();

  // 1. Lire manifest.json
  const manifestFile = unzipped['manifest.json'];
  if (!manifestFile) {
    throw new Error('Fichier manifest.json introuvable dans l\'archive .srproj');
  }

  const manifestText = new TextDecoder().decode(manifestFile);
  const manifest: DocumentV2 = JSON.parse(manifestText);

  // 2. Lire les assets
  for (const font of manifest.assets.fonts) {
    if (font.path && unzipped[font.path]) {
      assetBlobs.set(font.assetId, new Blob([unzipped[font.path]], { type: font.mimeType }));
    }
  }
  for (const img of Object.values(manifest.assets.images)) {
    if (img.path && unzipped[img.path]) {
      assetBlobs.set(img.assetId, new Blob([unzipped[img.path]], { type: img.mimeType }));
    }
  }

  return { manifest, assetBlobs };
}

// ─── Validation schéma ─────────────────────────────────────────────────

export function validateDocumentV2(doc: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!doc.schemaVersion || doc.schemaVersion !== "2.0") {
    errors.push('schemaVersion doit être "2.0"');
  }
  if (!doc.id) errors.push('id manquant');
  if (!doc.title) errors.push('title manquant');
  if (!doc.assets) errors.push('assets manquant');
  if (!doc.pageLayout) errors.push('pageLayout manquant');
  if (!Array.isArray(doc.blocks)) errors.push('blocks doit être un tableau');
  if (!doc.settings) errors.push('settings manquant');

  if (Array.isArray(doc.blocks)) {
    for (let i = 0; i < doc.blocks.length; i++) {
      const block = doc.blocks[i];
      if (!block.id) errors.push(`Bloc ${i}: id manquant`);
      if (!block.type) errors.push(`Bloc ${i}: type manquant`);
      if (typeof block.locked !== 'boolean') errors.push(`Bloc ${i}: locked doit être boolean`);
      if (typeof block.autoUpdate !== 'boolean') errors.push(`Bloc ${i}: autoUpdate doit être boolean`);
      if (!Array.isArray(block.dependsOn)) errors.push(`Bloc ${i}: dependsOn doit être un tableau`);
      if (typeof block.order !== 'number') errors.push(`Bloc ${i}: order doit être un nombre`);
    }
  }

  return { valid: errors.length === 0, errors };
}
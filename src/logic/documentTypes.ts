/**
 * documentTypes.ts — Schéma v2.0 du document ScoutRaider
 * Format portable .srproj (ZIP avec manifest.json + assets)
 * Remplace l'ancien format .srdoc (JSON pur)
 */

// ─── Assets ────────────────────────────────────────────────────────────────

export interface FontAsset {
  id: string;              // Identifiant unique interne (ex: "font_custom_1")
  family: string;          // Nom de famille CSS (ex: "Cinzel")
  assetId: string;         // Clé S3/Garage (ex: "fonts/cinzel-bold.woff2")
  path: string;            // Chemin dans l'archive .srproj (ex: "assets/fonts/Cinzel-Bold.woff2")
  weight: number;          // Poids de la police (400, 700, etc.)
  mimeType: string;        // "font/woff2" | "font/ttf"
}

export interface ImageAsset {
  assetId: string;         // Clé S3/Garage (ex: "images/img_01.webp")
  path: string;            // Chemin dans l'archive (ex: "assets/images/img_01.webp")
  width: number;           // Largeur en pixels
  height: number;          // Hauteur en pixels
  mimeType: string;        // "image/webp" | "image/png" | "image/jpeg"
  originalName?: string;   // Nom original du fichier
}

export interface DocumentAssets {
  fonts: FontAsset[];
  images: Record<string, ImageAsset>;  // Clé = assetId local (ex: "img_01")
}

// ─── Mise en page paginée (A4) ────────────────────────────────────────────

export type PaperFormat = "A4" | "A5" | "A3" | "Letter";
export type Orientation = "portrait" | "landscape";

export interface Margins {
  top: string;    // Ex: "20mm"
  bottom: string;
  left: string;
  right: string;
}

export interface HeaderFooterConfig {
  enabled: boolean;
  left?: string;      // Contenu gauche (supporte {{document.title}}, {{page}}, {{pages}})
  center?: string;    // Contenu centre
  right?: string;     // Contenu droite
  fontId?: string;    // Référence à FontAsset.id
  fontSize?: string;  // Ex: "9pt"
  color?: string;     // Couleur CSS
}

export interface PageLayout {
  format: PaperFormat;
  orientation: Orientation;
  margins: Margins;
  header: HeaderFooterConfig;
  footer: HeaderFooterConfig;
  backgroundColor?: string;  // Couleur de fond page (défaut: #ffffff)
}

// ─── Blocs de contenu ─────────────────────────────────────────────────────

export type BlockType =
  | "rich_text"           // Texte riche (paragraphes, titres, images inline, code)
  | "crypto_block"        // Bloc chiffré auto-généré (Vigenère, Morse, etc.)
  | "map_snippet"         // Extrait de carte Leaflet statique
  | "elevation_profile"   // Profil altimétrique SVG
  | "route_table"         // Tableau récapitulatif itinéraire
  | "page_break"          // Saut de page forcé
  | "annexe"              // Annexe de décodage (Morse, Polybe, etc.)
  | "title_page";         // Page de garde

export interface RichTextContent {
  type: "paragraph" | "heading" | "inline_image" | "code_block" | "bullet_list" | "ordered_list" | "blockquote";
  text?: string;
  assetId?: string;           // Pour inline_image : référence à DocumentAssets.images
  align?: "left" | "center" | "right" | "justify";
  widthPercent?: number;      // Pour images: % de la largeur page
  level?: 1 | 2 | 3;          // Pour heading
  language?: string;          // Pour code_block
  items?: string[];           // Pour listes
  fontFamily?: string;        // Police custom (référence FontAsset.family)
  fontSize?: string;          // Taille custom
  color?: string;             // Couleur custom
  backgroundColor?: string;   // Fond custom
}

export interface CryptoBlockConfig {
  cipher: "vigenere" | "morse" | "polybe" | "templier" | "maritime" | "avocat" | "cassis";
  key?: string;               // Clé de chiffrement (ex: pour Vigenère)
  sourceText: string;         // Texte source (clair)
  renderedText: string;       // Texte chiffré (affiché au participant)
  autoRegenerate: boolean;    // Recaculer si sourceText change
}

export interface MapSnippetConfig {
  center: [number, number];   // [lat, lon]
  zoom: number;
  width: number;              // Pixels
  height: number;
  scaleName: string;          // "1:25000", "1:50000", "auto"
  layerId: string;            // "PLAN.IGN", "SAT.IGN", "OSM", etc.
  showRoute: boolean;
  showEndpoints: boolean;
  showAnnotations: boolean;
  routeCoords?: [number, number][];  // [lat, lon][]
  assetId?: string;           // Référence image générée (optionnel)
}

export interface ElevationProfileConfig {
  svg: string;                // SVG du profil
  stats: {
    ascend_m: number;
    descend_m: number;
    min_alt_m: number;
    max_alt_m: number;
    duration_min: number;
  };
  width: number;
  height: number;
}

export interface RouteTableConfig {
  columns: ("step" | "azimuth" | "distance" | "module" | "pois" | "cumulative")[];
  rows: RouteTableRow[];
}

export interface RouteTableRow {
  step: string;           // "A → B"
  azimuth: number;
  distance: number;       // mètres
  module: string;
  pois: string[];
  cumulative: number;     // mètres
}

export interface AnnexeConfig {
  type: "morse" | "polybe" | "vigenere" | "maritime" | "templier" | "avocat";
  title: string;
  content: string;        // HTML ou tableau pré-rendu
}

export interface TitlePageConfig {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string;
  backgroundImageAssetId?: string;
  logoAssetId?: string;
}

export type BlockConfig =
  | CryptoBlockConfig
  | MapSnippetConfig
  | ElevationProfileConfig
  | RouteTableConfig
  | AnnexeConfig
  | TitlePageConfig;

export interface DocumentBlock {
  id: string;                    // UUID v4 (ex: "blk_01")
  type: BlockType;
  locked: boolean;               // true = protégé contre édition manuelle
  autoUpdate: boolean;           // true = recalculé automatiquement si dependsOn change
  dependsOn: string[];           // IDs sources (ex: ["route_main", "segment_3"])
  order: number;                 // Ordre d'affichage dans le document
  content?: RichTextContent[];   // Pour rich_text, title_page
  config?: BlockConfig;          // Pour blocs dynamiques
  renderedText?: string;         // Cache du rendu textuel (pour crypto_block, etc.)
  metadata?: Record<string, any>; // Données additionnelles
}

// ─── Document complet v2.0 ────────────────────────────────────────────────

export interface DocumentV2 {
  schemaVersion: "2.0";
  id: string;                    // UUID du document
  title: string;
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  version: number;               // Optimistic locking
  assets: DocumentAssets;
  pageLayout: PageLayout;
  blocks: DocumentBlock[];
  settings: DocumentSettings;
}

export interface DocumentSettings {
  autoSave: boolean;
  autoSaveInterval: number;      // ms (défaut: 1000)
  spellCheck: boolean;
  showInvisibles: boolean;
  defaultFontFamily: string;     // FontAsset.family ou système
  defaultFontSize: string;       // Ex: "11pt"
  theme: "light" | "dark" | "system";
}

// ─── Opérations de synchronisation ────────────────────────────────────────

export type SyncOperationType =
  | "asset_upload"
  | "doc_save"
  | "doc_delete"
  | "doc_import";

export interface PendingSyncOperation {
  id?: number;                   // Auto-incrément Dexie
  type: SyncOperationType;
  documentId: string;
  payload: any;
  timestamp: number;
  retries: number;
  status: "pending" | "syncing" | "completed" | "failed";
  error?: string;
}

// ─── Helpers de création ──────────────────────────────────────────────────

export function createDefaultPageLayout(): PageLayout {
  return {
    format: "A4",
    orientation: "portrait",
    margins: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    header: {
      enabled: true,
      left: "Troupe 1ère Port-Marly",
      right: "{{document.title}}",
      fontSize: "8pt",
      color: "#666666"
    },
    footer: {
      enabled: true,
      center: "Page {{page}} / {{pages}}",
      fontSize: "8pt",
      color: "#999999"
    },
    backgroundColor: "#ffffff"
  };
}

export function createDefaultDocumentSettings(): DocumentSettings {
  return {
    autoSave: true,
    autoSaveInterval: 1000,
    spellCheck: true,
    showInvisibles: false,
    defaultFontFamily: "system-ui",
    defaultFontSize: "11pt",
    theme: "system"
  };
}

export function generateBlockId(): string {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateAssetId(prefix: string = "asset"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
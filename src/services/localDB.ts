/**
 * localDB.ts — Base de données locale IndexedDB via Dexie.js
 * Cache documents, assets, queue de synchronisation hors-ligne
 */

import Dexie, { Table } from 'dexie';
import type { DocumentV2, DocumentAssets, FontAsset, ImageAsset } from '../logic/documentTypes';

export class ScoutRaiderDB extends Dexie {
  documents!: Table<LocalDocument, string>;
  assets!: Table<LocalAsset, string>;
  pendingSync!: Table<PendingSyncOperation, number>;
  preferences!: Table<LocalPreference, string>;

  constructor() {
    super('ScoutRaiderDB');
    this.version(1).stores({
      documents: 'id, updatedAt, schemaVersion, title, version, syncedAt',
      assets: 'assetId, documentId, mimeType, size, width, height, cachedAt',
      pendingSync: '++id, type, documentId, timestamp, status, retries',
      preferences: 'key'
    });
  }
}

export interface LocalDocument {
  id: string;
  schemaVersion: '2.0';
  title: string;
  json: DocumentV2;           // Document complet sérialisé
  updatedAt: number;          // Timestamp local
  syncedAt?: number;          // Dernière sync réussie
  version: number;            // Optimistic locking
  isDirty: boolean;           // Modifications non synchronisées
  filePath?: string;          // Chemin fichier local (.srproj)
}

export interface LocalAsset {
  assetId: string;            // Clé S3
  documentId: string;         // Document parent
  blob: Blob;                 // Données binaires
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  cachedAt: number;           // Quand mis en cache
  isUploaded: boolean;        // Déjà sur S3 ?
}

export interface LocalPreference {
  key: string;
  value: any;
  updatedAt: number;
}

export interface PendingSyncOperation {
  id?: number;
  type: SyncOperationType;
  documentId: string;
  payload: any;               // Données selon le type
  timestamp: number;
  retries: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

export type SyncOperationType =
  | 'asset_upload'
  | 'doc_save'
  | 'doc_delete'
  | 'doc_import'
  | 'asset_delete';

// Instance singleton
export const db = new ScoutRaiderDB();

// ─── Helpers Documents ──────────────────────────────────────────────────

export async function saveDocumentLocal(doc: DocumentV2, filePath?: string): Promise<void> {
  const existing = await db.documents.get(doc.id);
  const now = Date.now();

  const localDoc: LocalDocument = {
    id: doc.id,
    schemaVersion: doc.schemaVersion,
    title: doc.title,
    json: doc,
    updatedAt: now,
    syncedAt: existing?.syncedAt,
    version: doc.version,
    isDirty: true,
    filePath
  };

  await db.documents.put(localDoc);

  // Ajouter à la queue de sync si en ligne
  if (navigator.onLine) {
    await queueSyncOperation({
      type: 'doc_save',
      documentId: doc.id,
      payload: { document: doc },
      timestamp: now,
      retries: 0,
      status: 'pending'
    });
  }
}

export async function getDocumentLocal(id: string): Promise<DocumentV2 | null> {
  const local = await db.documents.get(id);
  return local?.json || null;
}

export async function getAllDocumentsLocal(): Promise<LocalDocument[]> {
  return db.documents.orderBy('updatedAt').reverse().toArray();
}

export async function deleteDocumentLocal(id: string): Promise<void> {
  await db.documents.delete(id);
  await queueSyncOperation({
    type: 'doc_delete',
    documentId: id,
    payload: {},
    timestamp: Date.now(),
    retries: 0,
    status: 'pending'
  });
}

export async function markDocumentSynced(id: string, serverVersion: number): Promise<void> {
  await db.documents.update(id, {
    syncedAt: Date.now(),
    version: serverVersion,
    isDirty: false
  });
}

export async function markDocumentDirty(id: string): Promise<void> {
  await db.documents.update(id, { isDirty: true });
}

// ─── Helpers Assets ─────────────────────────────────────────────────────

export async function cacheAsset(
  assetId: string,
  documentId: string,
  blob: Blob,
  mimeType: string,
  width?: number,
  height?: number
): Promise<void> {
  await db.assets.put({
    assetId,
    documentId,
    blob,
    mimeType,
    size: blob.size,
    width,
    height,
    cachedAt: Date.now(),
    isUploaded: false
  });
}

export async function getCachedAsset(assetId: string): Promise<Blob | null> {
  const asset = await db.assets.get(assetId);
  return asset?.blob || null;
}

export async function getAssetInfo(assetId: string): Promise<LocalAsset | null> {
  const asset = await db.assets.get(assetId);
  return asset || null;
}

export async function markAssetUploaded(assetId: string): Promise<void> {
  await db.assets.update(assetId, { isUploaded: true });
}

export async function deleteCachedAsset(assetId: string): Promise<void> {
  await db.assets.delete(assetId);
}

export async function getAssetsForDocument(documentId: string): Promise<LocalAsset[]> {
  return db.assets.where('documentId').equals(documentId).toArray();
}

export async function clearDocumentAssets(documentId: string): Promise<void> {
  const assets = await getAssetsForDocument(documentId);
  for (const asset of assets) {
    await db.assets.delete(asset.assetId);
  }
}

// ─── Queue de synchronisation ───────────────────────────────────────────

export async function queueSyncOperation(op: Omit<PendingSyncOperation, 'id'>): Promise<number> {
  return db.pendingSync.add(op as PendingSyncOperation);
}

export async function getPendingOperations(): Promise<PendingSyncOperation[]> {
  return db.pendingSync
    .where('status')
    .anyOf(['pending', 'failed'])
    .sortBy('timestamp');
}

export async function getSyncOperation(id: number): Promise<PendingSyncOperation | undefined> {
  return db.pendingSync.get(id);
}

export async function updateSyncOperation(id: number, updates: Partial<PendingSyncOperation>): Promise<void> {
  await db.pendingSync.update(id, updates);
}

export async function markSyncCompleted(id: number): Promise<void> {
  await db.pendingSync.update(id, { status: 'completed' });
}

export async function markSyncFailed(id: number, error: string): Promise<void> {
  const existing = await db.pendingSync.get(id);
  await db.pendingSync.update(id, { status: 'failed', error, retries: (existing?.retries ?? 0) + 1 });
}

export async function clearCompletedSync(): Promise<void> {
  await db.pendingSync.where('status').equals('completed').delete();
}

export async function retryFailedSync(): Promise<void> {
  const failed = await db.pendingSync.where('status').equals('failed').toArray();
  for (const op of failed) {
    if (op.retries < 5) {
      await db.pendingSync.update(op.id!, { status: 'pending', retries: op.retries + 1 });
    }
  }
}

// ─── Préférences ────────────────────────────────────────────────────────

export async function setPreference(key: string, value: any): Promise<void> {
  await db.preferences.put({ key, value, updatedAt: Date.now() });
}

export async function getPreference<T>(key: string, defaultValue?: T): Promise<T | undefined> {
  const pref = await db.preferences.get(key);
  return pref?.value ?? defaultValue;
}

export async function deletePreference(key: string): Promise<void> {
  await db.preferences.delete(key);
}

// ─── Nettoyage / Maintenance ────────────────────────────────────────────

export async function cleanupOldCache(maxAgeDays = 30): Promise<void> {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  // Supprimer assets non uploadés et anciens
  await db.assets.where('cachedAt').below(cutoff).and(a => !a.isUploaded).delete();
  // Supprimer opérations sync complétées anciennes
  await db.pendingSync.where('timestamp').below(cutoff).and(op => op.status === 'completed').delete();
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const est = await navigator.storage.estimate();
      return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Migration depuis ancien format .srdoc ──────────────────────────────

export async function migrateFromSrdoc(srdocJson: string): Promise<DocumentV2> {
  const oldState = JSON.parse(srdocJson);
  // La migration réelle se fait via documentMigration.ts
  // Ici on stocke juste l'ancien format pour référence
  await setPreference('legacy_srdoc_backup', oldState);
  throw new Error('Utilisez documentMigration.ts pour la conversion complète');
}

// Initialisation DB
db.open().catch(err => {
  console.error('[LocalDB] Erreur ouverture:', err);
});

// Écouteurs online/offline pour trigger sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[LocalDB] En ligne - déclenchement sync');
    // Import dynamique pour éviter cycle
    import('./syncService').then(({ processSyncQueue }) => processSyncQueue());
  });
}
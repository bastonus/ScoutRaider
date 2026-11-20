/**
 * syncService.ts — Service de synchronisation hors-ligne
 * Traite la queue d'opérations, gère retries, backoff exponentiel
 */

import { documentsApi, assetsApi, API_BASE, type AssetUploadResponse, type DocumentV2, ApiError } from './api';
import {
  getPendingOperations,
  updateSyncOperation,
  markSyncCompleted,
  markSyncFailed,
  getCachedAsset,
  markAssetUploaded,
  markDocumentSynced,
  deleteDocumentLocal,
  clearDocumentAssets
} from './localDB';
import type { PendingSyncOperation, SyncOperationType } from './localDB';

// Configuration
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const BATCH_SIZE = 5;

let isProcessing = false;
let abortController: AbortController | null = null;

export async function processSyncQueue(): Promise<void> {
  if (isProcessing || !navigator.onLine) return;

  isProcessing = true;
  abortController = new AbortController();

  try {
    const pending = await getPendingOperations();
    if (pending.length === 0) return;

    console.log(`[SyncService] Traitement de ${pending.length} opérations en attente`);

    // Traiter par lots
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      if (abortController?.signal.aborted) break;
      if (!navigator.onLine) break;

      const batch = pending.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(op => processOperation(op)));
    }
  } finally {
    isProcessing = false;
    abortController = null;
  }
}

async function processOperation(op: PendingSyncOperation): Promise<void> {
  const opId = op.id!;
  await updateSyncOperation(opId, { status: 'syncing' });

  try {
    switch (op.type) {
      case 'asset_upload':
        await syncAssetUpload(op);
        break;
      case 'doc_save':
        await syncDocSave(op);
        break;
      case 'doc_delete':
        await syncDocDelete(op);
        break;
      case 'doc_import':
        await syncDocImport(op);
        break;
      case 'asset_delete':
        await syncAssetDelete(op);
        break;
    }
    await markSyncCompleted(opId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[SyncService] Échec opération ${op.type} (${opId}):`, message);
    await markSyncFailed(opId, message);
  }
}

async function syncAssetUpload(op: PendingSyncOperation): Promise<void> {
  const { documentId, assetId, file, mimeType } = op.payload;

  // Récupérer le blob depuis le cache local
  const blob = await getCachedAsset(assetId);
  if (!blob) throw new Error(`Asset ${assetId} non trouvé en cache local`);

  // Upload vers backend
  const formData = new FormData();
  formData.append('file', new File([blob], assetId, { type: mimeType }));
  formData.append('document_id', documentId);

  const token = localStorage.getItem('scoutraider_token');
  const response = await fetch(`${API_BASE}/api/assets`, {
    method: 'POST',
    headers: { ...(token && { 'Authorization': `Bearer ${token}` }) },
    body: formData
  });

  if (!response.ok) {
    const err = await response.json();
    throw new ApiError(response.status, err.detail || 'Échec upload asset');
  }

  const result: AssetUploadResponse = await response.json();

  // Marquer comme uploadé
  await markAssetUploaded(assetId);
}

async function syncDocSave(op: PendingSyncOperation): Promise<void> {
  const { document } = op.payload as { document: DocumentV2 };

  const response = await documentsApi.update(document.id, document, document.version - 1);
  await markDocumentSynced(document.id, response.version);
}

async function syncDocDelete(op: PendingSyncOperation): Promise<void> {
  const { documentId } = op.payload;
  await documentsApi.delete(documentId);
  await deleteDocumentLocal(documentId);
  await clearDocumentAssets(documentId);
}

async function syncDocImport(op: PendingSyncOperation): Promise<void> {
  const { file } = op.payload;
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('scoutraider_token');
  const response = await fetch(`${API_BASE}/api/documents/import`, {
    method: 'POST',
    headers: { ...(token && { 'Authorization': `Bearer ${token}` }) },
    body: formData
  });

  if (!response.ok) throw new ApiError(response.status, 'Échec import');
}

async function syncAssetDelete(op: PendingSyncOperation): Promise<void> {
  const { assetId } = op.payload;
  await assetsApi.delete(assetId);
}

// ─── Retry avec backoff exponentiel ────────────────────────────────────

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  baseDelay = BASE_DELAY_MS
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Ne pas retry sur erreurs 4xx (sauf 429, 408)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429 && error.status !== 408) {
        throw error;
      }

      if (attempt === retries) break;

      const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 1000, MAX_DELAY_MS);
      console.log(`[SyncService] Retry ${attempt + 1}/${retries} dans ${delay}ms:`, lastError.message);
      await sleep(delay);
    }
  }

  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Autosave débouncé ─────────────────────────────────────────────────

interface AutosaveConfig {
  documentId: string;
  getDocument: () => DocumentV2;
  onSave: (doc: DocumentV2) => Promise<void>;
  interval?: number;
}

const autosaveTimers = new Map<string, NodeJS.Timeout>();
const pendingAutosaves = new Map<string, DocumentV2>();

export function scheduleAutosave(config: AutosaveConfig): void {
  const { documentId, getDocument, onSave, interval = 1000 } = config;

  // Annuler timer existant
  const existingTimer = autosaveTimers.get(documentId);
  if (existingTimer) clearTimeout(existingTimer);

  // Stocker la version en attente
  pendingAutosaves.set(documentId, getDocument());

  // Nouveau timer
  const timer = setTimeout(async () => {
    autosaveTimers.delete(documentId);
    const doc = pendingAutosaves.get(documentId);
    if (doc) {
      pendingAutosaves.delete(documentId);
      try {
        await onSave(doc);
        console.log(`[SyncService] Autosave effectué pour ${documentId}`);
      } catch (error) {
        console.error('[SyncService] Erreur autosave:', error);
        // Remettre en attente pour retry
        pendingAutosaves.set(documentId, doc);
        scheduleAutosave(config);
      }
    }
  }, interval);

  autosaveTimers.set(documentId, timer);
}

export function cancelAutosave(documentId: string): void {
  const timer = autosaveTimers.get(documentId);
  if (timer) {
    clearTimeout(timer);
    autosaveTimers.delete(documentId);
  }
  pendingAutosaves.delete(documentId);
}

export function flushAutosave(documentId: string): void {
  const timer = autosaveTimers.get(documentId);
  if (timer) {
    clearTimeout(timer);
    autosaveTimers.delete(documentId);
  }
  const doc = pendingAutosaves.get(documentId);
  if (doc) {
    pendingAutosaves.delete(documentId);
    // Le callback onSave sera appelé via le timer qui vient d'être clearTimeout
    // On doit le déclencher manuellement - à gérer par l'appelant
  }
}

// ─── Gestionnaire de connexion ─────────────────────────────────────────

export function initSyncService(): void {
  if (typeof window === 'undefined') return;

  // Traiter la queue au démarrage si en ligne
  if (navigator.onLine) {
    setTimeout(() => processSyncQueue(), 1000);
  }

  // Écouter changements de connexion
  window.addEventListener('online', () => {
    console.log('[SyncService] Connexion rétablie');
    setTimeout(() => processSyncQueue(), 500);
  });

  window.addEventListener('offline', () => {
    console.log('[SyncService] Mode hors-ligne');
    if (abortController) abortController.abort();
  });

  // Sync périodique (toutes les 30s si en ligne)
  setInterval(() => {
    if (navigator.onLine && !isProcessing) {
      processSyncQueue();
    }
  }, 30000);

  // Nettoyage quotidien
  setInterval(() => {
    import('./localDB').then(({ clearCompletedSync }) => clearCompletedSync());
  }, 24 * 60 * 60 * 1000);
}

// ─── Export pour contrôle manuel ───────────────────────────────────────

export const syncController = {
  get isProcessing() { return isProcessing; },
  abort: () => abortController?.abort(),
  forceSync: () => processSyncQueue(),
  retryFailed: async () => {
    await import('./localDB').then(({ retryFailedSync }) => retryFailedSync());
    await processSyncQueue();
  }
};
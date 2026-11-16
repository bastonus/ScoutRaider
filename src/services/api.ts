/**
 * api.ts — Client API frontend pour communication avec le backend Python
 * Gère: authentification, upload assets, CRUD documents, export PDF/.srproj
 */

import type { DocumentV2, DocumentAssets, FontAsset, ImageAsset, PendingSyncOperation } from '../logic/documentTypes';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const S3_PUBLIC_URL = import.meta.env.VITE_S3_PUBLIC_URL || 'https://s3-scoutraider.silverhorse.fr';

class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('scoutraider_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorData: any = {};
    try { errorData = await response.json(); } catch {}
    throw new ApiError(response.status, errorData.detail || `HTTP ${response.status}`, errorData);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

// ─── Authentification ────────────────────────────────────────────────────

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
}

export const authApi = {
  async login(username: string, password: string): Promise<AuthTokens> {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new ApiError(response.status, err.detail || 'Échec de connexion');
    }

    const tokens = await response.json();
    localStorage.setItem('scoutraider_token', tokens.access_token);
    localStorage.setItem('scoutraider_refresh', tokens.refresh_token);
    return tokens;
  },

  async register(username: string, email: string, password: string): Promise<UserProfile> {
    return fetchWithAuth<UserProfile>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
  },

  async refreshToken(): Promise<AuthTokens> {
    const refresh = localStorage.getItem('scoutraider_refresh');
    if (!refresh) throw new Error('Pas de refresh token');

    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh })
    });

    if (!response.ok) throw new Error('Refresh token invalide');

    const tokens = await response.json();
    localStorage.setItem('scoutraider_token', tokens.access_token);
    localStorage.setItem('scoutraider_refresh', tokens.refresh_token);
    return tokens;
  },

  async getProfile(): Promise<UserProfile> {
    return fetchWithAuth<UserProfile>('/api/auth/me');
  },

  logout() {
    localStorage.removeItem('scoutraider_token');
    localStorage.removeItem('scoutraider_refresh');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('scoutraider_token');
  }
};

// ─── Assets (upload/download) ────────────────────────────────────────────

export interface AssetUploadResponse {
  assetId: string;
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

export const assetsApi = {
  async upload(file: File, documentId?: string): Promise<AssetUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (documentId) formData.append('document_id', documentId);

    const token = localStorage.getItem('scoutraider_token');
    const response = await fetch(`${API_BASE}/api/assets`, {
      method: 'POST',
      headers: { ...(token && { 'Authorization': `Bearer ${token}` }) },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      throw new ApiError(response.status, err.detail || 'Échec upload');
    }

    return response.json();
  },

  async download(assetId: string): Promise<Blob> {
    const token = localStorage.getItem('scoutraider_token');
    const response = await fetch(`${API_BASE}/api/assets/${assetId}`, {
      headers: { ...(token && { 'Authorization': `Bearer ${token}` }) }
    });

    if (!response.ok) throw new ApiError(response.status, 'Échec téléchargement');
    return response.blob();
  },

  async getPresignedUrl(assetId: string, expiry = 3600): Promise<string> {
    return fetchWithAuth<string>(`/api/assets/${assetId}/url?expiry=${expiry}`);
  },

  async delete(assetId: string): Promise<void> {
    await fetchWithAuth<void>(`/api/assets/${assetId}`, { method: 'DELETE' });
  },

  // Construire l'URL publique S3 pour un asset
  getPublicUrl(assetId: string, assetType: 'font' | 'image' | 'map' = 'image'): string {
    const prefix = { font: 'fonts', image: 'images', map: 'maps' }[assetType];
    return `${S3_PUBLIC_URL}/scoutraider-assets/${prefix}/${assetId}`;
  }
};

// ─── Documents CRUD ──────────────────────────────────────────────────────

export interface DocumentListItem {
  id: string;
  title: string;
  updatedAt: string;
  version: number;
  ownerId: string;
  isShared: boolean;
}

export interface DocumentCreate {
  title: string;
  schemaVersion: '2.0';
}

export const documentsApi = {
  async list(params?: { limit?: number; offset?: number; search?: string }): Promise<DocumentListItem[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.search) query.set('search', params.search);
    return fetchWithAuth<DocumentListItem[]>(`/api/documents?${query}`);
  },

  async get(id: string): Promise<DocumentV2> {
    return fetchWithAuth<DocumentV2>(`/api/documents/${id}`);
  },

  async create(data: DocumentCreate): Promise<DocumentV2> {
    return fetchWithAuth<DocumentV2>('/api/documents', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async update(id: string, document: DocumentV2, expectedVersion: number): Promise<DocumentV2> {
    return fetchWithAuth<DocumentV2>(`/api/documents/${id}`, {
      method: 'PUT',
      headers: { 'If-Match': expectedVersion.toString() },
      body: JSON.stringify(document)
    });
  },

  async delete(id: string): Promise<void> {
    await fetchWithAuth<void>(`/api/documents/${id}`, { method: 'DELETE' });
  },

  async duplicate(id: string, newTitle?: string): Promise<DocumentV2> {
    return fetchWithAuth<DocumentV2>(`/api/documents/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ title: newTitle })
    });
  }
};

// ─── Export ──────────────────────────────────────────────────────────────

export interface ExportOptions {
  format: 'pdf' | 'srproj' | 'html';
  version?: 'participant' | 'solution' | 'both';
  includeAnnexes?: boolean;
  includeMapPagination?: boolean;
}

export const exportApi = {
  async exportPdf(documentId: string, options: ExportOptions = { format: 'pdf' }): Promise<Blob> {
    const token = localStorage.getItem('scoutraider_token');
    const response = await fetch(`${API_BASE}/api/documents/${documentId}/export/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new ApiError(response.status, err.detail || 'Échec export PDF');
    }

    return response.blob();
  },

  async exportSrproj(documentId: string): Promise<Blob> {
    const token = localStorage.getItem('scoutraider_token');
    const response = await fetch(`${API_BASE}/api/documents/${documentId}/export/srproj`, {
      headers: { ...(token && { 'Authorization': `Bearer ${token}` }) }
    });

    if (!response.ok) throw new ApiError(response.status, 'Échec export .srproj');
    return response.blob();
  },

  async exportHtml(documentId: string, options: ExportOptions = { format: 'html' }): Promise<string> {
    const token = localStorage.getItem('scoutraider_token');
    const response = await fetch(`${API_BASE}/api/documents/${documentId}/export/html`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify(options)
    });

    if (!response.ok) throw new ApiError(response.status, 'Échec export HTML');
    return response.text();
  }
};

// ─── Import .srproj ──────────────────────────────────────────────────────

export const importApi = {
  async importSrproj(file: File): Promise<DocumentV2> {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('scoutraider_token');
    const response = await fetch(`${API_BASE}/api/documents/import`, {
      method: 'POST',
      headers: { ...(token && { 'Authorization': `Bearer ${token}` }) },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      throw new ApiError(response.status, err.detail || 'Échec import');
    }

    return response.json();
  }
};

// ─── Partage / Collaboration ────────────────────────────────────────────

export interface ShareToken {
  token: string;
  url: string;
  expiresAt?: string;
  permissions: 'read' | 'comment' | 'edit';
}

export const shareApi = {
  async createShareLink(documentId: string, permissions: 'read' | 'comment' | 'edit' = 'read', expiresInDays?: number): Promise<ShareToken> {
    return fetchWithAuth<ShareToken>(`/api/documents/${documentId}/share`, {
      method: 'POST',
      body: JSON.stringify({ permissions, expires_in_days: expiresInDays })
    });
  },

  async getShareInfo(token: string): Promise<{ documentId: string; permissions: string }> {
    return fetchWithAuth(`/api/share/${token}`);
  },

  async revokeShare(documentId: string): Promise<void> {
    await fetchWithAuth<void>(`/api/documents/${documentId}/share`, { method: 'DELETE' });
  }
};

// ─── Utilitaires ─────────────────────────────────────────────────────────

export async function checkBackendHealth(): Promise<{ status: string; version: string; weasyprint: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.json();
  } catch {
    return { status: 'unreachable', version: 'unknown', weasyprint: false };
  }
}

export { ApiError };
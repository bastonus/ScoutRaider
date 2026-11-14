/**
 * CloudAuthService.ts — Client service for ScoutRaider account authentication and PostgreSQL cloud sync.
 * Supports Web (same-origin relative paths) and Electron (remote server fallback).
 */

import type { AppState } from './types';

export interface UserProfile {
    id: string;
    username: string;
    email?: string | null;
}

export interface CloudProjectSummary {
    id: string;
    title: string;
    share_token?: string;
    is_public?: boolean;
    public_role?: 'viewer' | 'editor';
    owner_id?: string;
    owner_username?: string;
    role?: 'owner' | 'editor' | 'viewer';
    is_owner?: boolean;
    created_at: string;
    updated_at: string;
}

export interface Collaborator {
    share_id: string;
    user_id: string;
    username: string;
    email?: string | null;
    role: 'viewer' | 'editor';
    created_at: string;
}

export interface ProjectSharingDetails {
    project_id: string;
    title: string;
    share_token: string;
    is_public: boolean;
    public_role: 'viewer' | 'editor';
    is_owner: boolean;
    owner: {
        id: string;
        username: string;
    };
    collaborators: Collaborator[];
}

export interface MarketplaceModule {
    id: string;
    name: string;
    category: 'code' | 'orchestration' | 'theme' | string;
    description: string;
    author_id?: string;
    author_username?: string;
    version: string;
    is_public: boolean;
    code?: string;
    config?: Record<string, any>;
    preview_image?: string;
    likes_count?: number;
    forked_from_id?: string;
    created_at?: string;
    updated_at?: string;
}

export interface UserLibraryItem {
    id: string;
    user_id: string;
    module_id: string;
    custom_name?: string;
    category: string;
    synced_at: string;
    local_overrides?: Record<string, any>;
    module_name?: string;
    module_desc?: string;
    version?: string;
    author_username?: string;
    preview_image?: string;
    is_public?: boolean;
}

const DEFAULT_REMOTE_API = 'https://scoutraider.silverhorse.fr';

export class CloudAuthService {
    private static TOKEN_KEY = 'scoutraider_auth_token';
    private static GUEST_KEY = 'scoutraider_is_guest';

    static getBaseUrl(): string {
        // If running in browser hosted on scoutraider.silverhorse.fr → relative URLs (nginx handles /api)
        if (typeof window !== 'undefined') {
            const origin = window.location.origin;
            if (!origin.startsWith('file:')) {
                // On localhost in dev, check if VITE_API_URL is set to override
                const viteApi = (import.meta as any).env?.VITE_API_URL;
                if (viteApi) return viteApi;
                // On localhost without local backend, fall back to prod
                if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
                    return DEFAULT_REMOTE_API;
                }
                return ''; // On prod server: relative URLs hit nginx /api
            }
        }
        return DEFAULT_REMOTE_API;
    }

    static getToken(): string | null {
        if (typeof localStorage === 'undefined') return null;
        return localStorage.getItem(this.TOKEN_KEY);
    }

    static setToken(token: string) {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(this.TOKEN_KEY, token);
            localStorage.removeItem(this.GUEST_KEY);
        }
    }

    static isGuest(): boolean {
        if (typeof localStorage === 'undefined') return true;
        const guestFlag = localStorage.getItem(this.GUEST_KEY);
        const hasToken = !!localStorage.getItem(this.TOKEN_KEY);
        return guestFlag === 'true' || !hasToken;
    }

    static setGuest(isGuest: boolean) {
        if (typeof localStorage !== 'undefined') {
            if (isGuest) {
                localStorage.setItem(this.GUEST_KEY, 'true');
                localStorage.removeItem(this.TOKEN_KEY);
            } else {
                localStorage.removeItem(this.GUEST_KEY);
            }
        }
    }

    static logout() {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(this.TOKEN_KEY);
            localStorage.setItem(this.GUEST_KEY, 'true');
        }
    }

    private static getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    // ─── Authentication ───────────────────────────────────────────────────────

    static async register(username: string, password: string, email?: string): Promise<{ user: UserProfile; token: string }> {
        const res = await fetch(`${this.getBaseUrl()}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email: email || null })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Échec de l\'inscription' }));
            throw new Error(err.detail || 'Échec de l\'inscription');
        }

        const data = await res.json();
        this.setToken(data.token);
        return data;
    }

    static async login(username_or_email: string, password: string): Promise<{ user: UserProfile; token: string }> {
        const res = await fetch(`${this.getBaseUrl()}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username_or_email, password })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Identifiants incorrects' }));
            throw new Error(err.detail || 'Identifiants incorrects');
        }

        const data = await res.json();
        this.setToken(data.token);
        return data;
    }

    static async getMe(): Promise<UserProfile | null> {
        const token = this.getToken();
        if (!token) return null;

        try {
            const res = await fetch(`${this.getBaseUrl()}/api/auth/me`, {
                headers: this.getHeaders()
            });
            if (!res.ok) {
                if (res.status === 401 || res.status === 404) {
                    // Token explicitly rejected by server — clear session
                    this.logout();
                    return null;
                }
                // 5xx or other error — network/server issue, keep token, fall through to local decode
                return this.decodeTokenLocally();
            }
            const data = await res.json();
            return data.user;
        } catch {
            // Network error (offline, timeout, etc.) — don't log out, use local JWT decode
            return this.decodeTokenLocally();
        }
    }

    /** Decode JWT payload locally (no signature verification) — for offline fallback only. */
    static decodeTokenLocally(): UserProfile | null {
        const token = this.getToken();
        if (!token) return null;
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            const payload = JSON.parse(atob(parts[1]));
            // Check expiry
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                this.logout();
                return null;
            }
            return {
                id: payload.sub,
                username: payload.username,
                email: payload.email || null,
            };
        } catch {
            return null;
        }
    }

    // ─── Cloud Projects ───────────────────────────────────────────────────────

    static async listProjects(): Promise<CloudProjectSummary[]> {
        const res = await fetch(`${this.getBaseUrl()}/api/projects`, {
            headers: this.getHeaders()
        });
        if (!res.ok) {
            throw new Error('Impossible de charger les projets distants');
        }
        return await res.json();
    }

    static async getProject(projectId: string): Promise<{ id: string; title: string; state: AppState }> {
        const res = await fetch(`${this.getBaseUrl()}/api/projects/${projectId}`, {
            headers: this.getHeaders()
        });
        if (!res.ok) {
            throw new Error('Impossible de charger le projet distant');
        }
        return await res.json();
    }

    static async saveProject(title: string, state: AppState, projectId?: string | null): Promise<CloudProjectSummary> {
        // Strip transient/local fields
        const cleanState: any = { ...state };
        delete cleanState.is_loading;
        delete cleanState.loading_text;
        delete cleanState.notifications;
        delete cleanState.current_filepath;

        const res = await fetch(`${this.getBaseUrl()}/api/projects`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                id: projectId || undefined,
                title: title.trim() || 'Document sans titre',
                state: cleanState
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Erreur lors de la sauvegarde cloud' }));
            throw new Error(err.detail || 'Erreur lors de la sauvegarde cloud');
        }

        return await res.json();
    }

    static async deleteProject(projectId: string): Promise<boolean> {
        const res = await fetch(`${this.getBaseUrl()}/api/projects/${projectId}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return res.ok;
    }

    // ─── Sharing & Permissions ────────────────────────────────────────────────

    static async getSharingDetails(projectId: string): Promise<ProjectSharingDetails> {
        const res = await fetch(`${this.getBaseUrl()}/api/projects/${projectId}/share`, {
            headers: this.getHeaders()
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Impossible de récupérer les autorisations' }));
            throw new Error(err.detail || 'Impossible de récupérer les autorisations');
        }
        return await res.json();
    }

    static async inviteCollaborator(projectId: string, usernameOrEmail: string, role: 'viewer' | 'editor' = 'viewer'): Promise<{ success: boolean; username: string; role: string }> {
        const res = await fetch(`${this.getBaseUrl()}/api/projects/${projectId}/share`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ username_or_email: usernameOrEmail, role })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Échec de l\'invitation' }));
            throw new Error(err.detail || 'Échec de l\'invitation');
        }
        return await res.json();
    }

    static async removeCollaborator(projectId: string, targetUserId: string): Promise<boolean> {
        const res = await fetch(`${this.getBaseUrl()}/api/projects/${projectId}/share/${targetUserId}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Impossible de retirer le collaborateur' }));
            throw new Error(err.detail || 'Impossible de retirer le collaborateur');
        }
        return true;
    }

    static async updatePublicAccess(projectId: string, isPublic: boolean, publicRole: 'viewer' | 'editor' = 'viewer'): Promise<{ is_public: boolean; public_role: string }> {
        const res = await fetch(`${this.getBaseUrl()}/api/projects/${projectId}/public-access`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ is_public: isPublic, public_role: publicRole })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Impossible de modifier l\'accès général' }));
            throw new Error(err.detail || 'Impossible de modifier l\'accès général');
        }
        return await res.json();
    }

    static async getSharedProject(identifier: string): Promise<{ id: string; title: string; state: AppState; role: 'owner' | 'editor' | 'viewer'; is_owner: boolean; share_token: string }> {
        const res = await fetch(`${this.getBaseUrl()}/api/projects/shared/${identifier}`, {
            headers: this.getHeaders()
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Document inaccessible ou introuvable' }));
            throw new Error(err.detail || 'Document inaccessible ou introuvable');
        }
        return await res.json();
    }

    // ─── Marketplace & Community Modules ──────────────────────────────────────

    static async listMarketplaceModules(category?: string, search?: string): Promise<MarketplaceModule[]> {
        const params = new URLSearchParams();
        if (category && category !== 'all') params.append('category', category);
        if (search) params.append('search', search);

        const url = `${this.getBaseUrl()}/api/marketplace/modules${params.toString() ? '?' + params.toString() : ''}`;
        const res = await fetch(url, { headers: this.getHeaders() });
        if (!res.ok) return [];
        return await res.json();
    }

    static async getMarketplaceModule(moduleId: string): Promise<MarketplaceModule> {
        const res = await fetch(`${this.getBaseUrl()}/api/marketplace/modules/${moduleId}`, {
            headers: this.getHeaders()
        });
        if (!res.ok) throw new Error('Module introuvable.');
        return await res.json();
    }

    static async saveMarketplaceModule(moduleData: Partial<MarketplaceModule>): Promise<MarketplaceModule> {
        const isUpdate = !!moduleData.id;
        const url = isUpdate 
            ? `${this.getBaseUrl()}/api/marketplace/modules/${moduleData.id}`
            : `${this.getBaseUrl()}/api/marketplace/modules`;

        const method = isUpdate ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: this.getHeaders(),
            body: JSON.stringify(moduleData)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Échec de publication du module' }));
            throw new Error(err.detail || 'Échec de publication du module');
        }
        return await res.json();
    }

    static async updateModuleVisibility(moduleId: string, isPublic: boolean): Promise<boolean> {
        const res = await fetch(`${this.getBaseUrl()}/api/marketplace/modules/${moduleId}/visibility`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify({ is_public: isPublic })
        });
        return res.ok;
    }

    static async forkMarketplaceModule(moduleId: string): Promise<MarketplaceModule> {
        const res = await fetch(`${this.getBaseUrl()}/api/marketplace/modules/${moduleId}/fork`, {
            method: 'POST',
            headers: this.getHeaders()
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Échec du fork du module' }));
            throw new Error(err.detail || 'Échec du fork');
        }
        return await res.json();
    }

    static async deleteMarketplaceModule(moduleId: string): Promise<boolean> {
        const res = await fetch(`${this.getBaseUrl()}/api/marketplace/modules/${moduleId}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return res.ok;
    }

    static async generateServerPreview(payload: { name: string; category: string; code?: string; version?: string }): Promise<string> {
        const res = await fetch(`${this.getBaseUrl()}/api/marketplace/preview`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Erreur de prévisualisation serveur' }));
            throw new Error(err.detail || 'Erreur de prévisualisation');
        }
        const data = await res.json();
        return data.preview_image;
    }

    // ─── Synchronized User Library ───────────────────────────────────────────

    static async getUserLibrary(): Promise<UserLibraryItem[]> {
        if (this.isGuest()) return [];
        const res = await fetch(`${this.getBaseUrl()}/api/library`, {
            headers: this.getHeaders()
        });
        if (!res.ok) return [];
        return await res.json();
    }

    static async addToUserLibrary(moduleId: string, customName?: string, category: string = 'code'): Promise<any> {
        if (this.isGuest()) return { success: false, guest: true };
        const res = await fetch(`${this.getBaseUrl()}/api/library/add/${moduleId}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ custom_name: customName, category })
        });
        return await res.json();
    }

    static async removeFromUserLibrary(moduleId: string): Promise<boolean> {
        if (this.isGuest()) return false;
        const res = await fetch(`${this.getBaseUrl()}/api/library/${moduleId}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return res.ok;
    }

    static async syncUserLibraryBatch(moduleIds: string[]): Promise<UserLibraryItem[]> {
        if (this.isGuest()) return [];
        const res = await fetch(`${this.getBaseUrl()}/api/library/sync`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ module_ids: moduleIds })
        });
        if (!res.ok) return [];
        return await res.json();
    }
}

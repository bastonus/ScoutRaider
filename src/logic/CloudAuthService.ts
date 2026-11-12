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

const DEFAULT_REMOTE_API = 'https://scoutraider.silverhorse.fr';

export class CloudAuthService {
    private static TOKEN_KEY = 'scoutraider_auth_token';
    private static GUEST_KEY = 'scoutraider_is_guest';

    static getBaseUrl(): string {
        // If running in browser hosted on scoutraider.silverhorse.fr or localhost
        if (typeof window !== 'undefined') {
            if (window.location && window.location.origin && !window.location.origin.startsWith('file:')) {
                return ''; // Relative URLs hit nginx /api
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
                if (res.status === 401) {
                    this.logout();
                }
                return null;
            }
            const data = await res.json();
            return data.user;
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
}

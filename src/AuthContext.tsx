/**
 * AuthContext.tsx — React Context for User Accounts, Guest Sessions, and PostgreSQL Cloud Sync.
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { CloudAuthService, type UserProfile, type CloudProjectSummary } from './logic/CloudAuthService';
import { useApp } from './AppContext';
import { StateManager } from './logic/StateManager';

export type CloudSyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'guest';

export type DocumentRole = 'owner' | 'editor' | 'viewer' | null;

interface AuthContextType {
    user: UserProfile | null;
    isGuest: boolean;
    isAuthenticated: boolean;
    isLoading: boolean;
    cloudSyncStatus: CloudSyncStatus;
    lastSavedTime: Date | null;
    cloudProjectId: string | null;
    currentProjectRole: DocumentRole;
    shareToken: string | null;
    authModalOpen: boolean;
    projectsModalOpen: boolean;
    shareModalOpen: boolean;
    setAuthModalOpen: (open: boolean) => void;
    setProjectsModalOpen: (open: boolean) => void;
    setShareModalOpen: (open: boolean) => void;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string, email?: string) => Promise<void>;
    continueAsGuest: () => void;
    logout: () => void;
    saveToCloudNow: () => Promise<void>;
    loadFromCloud: (projectId: string) => Promise<void>;
    loadSharedDoc: (identifier: string) => Promise<void>;
    makeEditableCopy: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { state, dispatch } = useApp();

    const [user, setUser] = useState<UserProfile | null>(null);
    const [isGuest, setIsGuest] = useState<boolean>(() => CloudAuthService.isGuest());
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('idle');
    const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
    const [cloudProjectId, setCloudProjectId] = useState<string | null>(null);
    const [currentProjectRole, setCurrentProjectRole] = useState<DocumentRole>(null);
    const [shareToken, setShareToken] = useState<string | null>(null);

    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [projectsModalOpen, setProjectsModalOpen] = useState(false);
    const [shareModalOpen, setShareModalOpen] = useState(false);

    // Load shared document via permalink (?doc=... or ?share=...)
    const loadSharedDoc = useCallback(async (identifier: string) => {
        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Ouverture du document partagé...' });
        try {
            const data = await CloudAuthService.getSharedProject(identifier);
            const loaded = StateManager.deserializeFromLoad(JSON.stringify({
                _scoutproj: true,
                _version: '5.0.0',
                state: data.state
            }));
            loaded.document_title = data.title;
            dispatch({ type: 'LOAD_PROJECT', state: loaded });
            setCloudProjectId(data.id);
            setCurrentProjectRole(data.role);
            setShareToken(data.share_token);
            setCloudSyncStatus(data.role === 'viewer' ? 'idle' : 'saved');
            setLastSavedTime(new Date());

            if (data.role === 'viewer') {
                dispatch({ 
                    type: 'ADD_NOTIFICATION', 
                    message: `Document "${data.title}" ouvert en lecture seule (Lecteur).`, 
                    notifType: 'info' 
                });
            } else {
                dispatch({ 
                    type: 'ADD_NOTIFICATION', 
                    message: `Document "${data.title}" ouvert (accès ${data.role === 'owner' ? 'Propriétaire' : 'Éditeur'}).`, 
                    notifType: 'info' 
                });
            }
        } catch (err: any) {
            dispatch({ type: 'ADD_NOTIFICATION', message: `Erreur d'accès : ${err.message}`, notifType: 'error' });
        } finally {
            dispatch({ type: 'SET_LOADING', isLoading: false });
        }
    }, [dispatch]);

    // Initial session & permalink query check
    useEffect(() => {
        let active = true;
        const checkSession = async () => {
            setIsLoading(true);
            const token = CloudAuthService.getToken();
            if (token) {
                const profile = await CloudAuthService.getMe();
                if (active) {
                    if (profile) {
                        setUser(profile);
                        setIsGuest(false);
                        setCloudSyncStatus('saved');
                    } else {
                        setUser(null);
                        setIsGuest(true);
                        setCloudSyncStatus('guest');
                    }
                }
            } else {
                setIsGuest(true);
                setCloudSyncStatus('guest');
            }
            if (active) setIsLoading(false);
        };
        checkSession();
        return () => { active = false; };
    }, [loadSharedDoc]);

    const makeEditableCopy = async () => {
        const newTitle = `Copie de ${state.document_title || 'Document sans titre'}`;
        const copyState = { ...state, document_title: newTitle };
        dispatch({ type: 'SET_DOCUMENT_TITLE', title: newTitle });
        setCloudProjectId(null);
        setCurrentProjectRole('owner');
        setShareToken(null);
        if (!isGuest && user) {
            dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Création de votre copie...' });
            try {
                const saved = await CloudAuthService.saveProject(newTitle, copyState, null);
                setCloudProjectId(saved.id);
                setCloudSyncStatus('saved');
                dispatch({ type: 'ADD_NOTIFICATION', message: `Copie modifiable créée : "${newTitle}"`, notifType: 'info' });
            } catch (e: any) {
                dispatch({ type: 'ADD_NOTIFICATION', message: e.message, notifType: 'error' });
            } finally {
                dispatch({ type: 'SET_LOADING', isLoading: false });
            }
        } else {
            dispatch({ type: 'ADD_NOTIFICATION', message: 'Copie locale créée. Connectez-vous pour la sauvegarder sur le cloud.', notifType: 'info' });
        }
    };

    // ─── Actions ──────────────────────────────────────────────────────────────

    const login = async (username: string, password: string) => {
        setIsLoading(true);
        try {
            const data = await CloudAuthService.login(username, password);
            setUser(data.user);
            setIsGuest(false);
            setCloudSyncStatus('saved');
            setAuthModalOpen(false);
            dispatch({ type: 'ADD_NOTIFICATION', message: `Connecté en tant que ${data.user.username}`, notifType: 'info' });
        } catch (err: any) {
            setIsLoading(false);
            throw err;
        }
        setIsLoading(false);
    };

    const register = async (username: string, password: string, email?: string) => {
        setIsLoading(true);
        try {
            const data = await CloudAuthService.register(username, password, email);
            setUser(data.user);
            setIsGuest(false);
            setCloudSyncStatus('saved');
            setAuthModalOpen(false);
            dispatch({ type: 'ADD_NOTIFICATION', message: `Bienvenue, ${data.user.username} ! Votre compte est créé.`, notifType: 'info' });
        } catch (err: any) {
            setIsLoading(false);
            throw err;
        }
        setIsLoading(false);
    };

    const continueAsGuest = () => {
        CloudAuthService.setGuest(true);
        setUser(null);
        setIsGuest(true);
        setCloudSyncStatus('guest');
        setAuthModalOpen(false);
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Mode Invité activé. Sauvegarde cloud désactivée.', notifType: 'info' });
    };

    const logout = () => {
        CloudAuthService.logout();
        setUser(null);
        setIsGuest(true);
        setCloudProjectId(null);
        setCloudSyncStatus('guest');
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Déconnexion effectuée.', notifType: 'info' });
    };

    const saveToCloudNow = useCallback(async () => {
        if (isGuest || !user) {
            return;
        }

        if (currentProjectRole === 'viewer') {
            return;
        }

        setCloudSyncStatus('saving');
        try {
            const docTitle = state.document_title || 'Document sans titre';
            const saved = await CloudAuthService.saveProject(docTitle, state, cloudProjectId);
            setCloudProjectId(saved.id);
            if (saved.share_token) {
                setShareToken(saved.share_token);
            }
            if (!currentProjectRole) {
                setCurrentProjectRole('owner');
            }
            setCloudSyncStatus('saved');
            setLastSavedTime(new Date());
        } catch (e) {
            console.error('Cloud auto-save error:', e);
            setCloudSyncStatus('error');
        }
    }, [isGuest, user, state, cloudProjectId, currentProjectRole]);

    const loadFromCloud = async (projectId: string) => {
        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Chargement depuis le cloud...' });
        try {
            const data: any = await CloudAuthService.getProject(projectId);
            const loaded = StateManager.deserializeFromLoad(JSON.stringify({
                _scoutproj: true,
                _version: '5.0.0',
                state: data.state
            }));
            loaded.document_title = data.title;
            dispatch({ type: 'LOAD_PROJECT', state: loaded });
            setCloudProjectId(data.id);
            setCurrentProjectRole(data.role || (data.owner_id === user?.id ? 'owner' : 'editor'));
            setShareToken(data.share_token || null);
            setCloudSyncStatus('saved');
            setLastSavedTime(new Date());
            setProjectsModalOpen(false);
            dispatch({ type: 'ADD_NOTIFICATION', message: `Projet "${data.title}" ouvert.`, notifType: 'info' });
        } catch (e: any) {
            dispatch({ type: 'ADD_NOTIFICATION', message: `Erreur: ${e.message}`, notifType: 'error' });
        } finally {
            dispatch({ type: 'SET_LOADING', isLoading: false });
        }
    };

    // ─── Debounced Auto-Save (when authenticated) ──────────────────────────────

    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const initialLoadRef = useRef(true);

    useEffect(() => {
        // Skip auto-save on initial mount
        if (initialLoadRef.current) {
            initialLoadRef.current = false;
            return;
        }

        if (isGuest || !user) {
            setCloudSyncStatus('guest');
            return;
        }

        if (currentProjectRole === 'viewer') {
            return;
        }

        // Debounce auto-save by 1.8 seconds after state mutation
        setCloudSyncStatus('saving');
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        autoSaveTimerRef.current = setTimeout(() => {
            saveToCloudNow();
        }, 1800);

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [
        state.document_title,
        state.stages,
        state.routes,
        state.polygonal_steps,
        state.itineraries,
        state.point_annotations,
        state.area_annotations,
        state.draw_annotations,
        state.theme_id,
        state.active_preset_id,
        isGuest,
        user,
        currentProjectRole,
        saveToCloudNow
    ]);

    return (
        <AuthContext.Provider value={{
            user,
            isGuest,
            isAuthenticated: !isGuest && !!user,
            isLoading,
            cloudSyncStatus,
            lastSavedTime,
            cloudProjectId,
            currentProjectRole,
            shareToken,
            authModalOpen,
            projectsModalOpen,
            shareModalOpen,
            setAuthModalOpen,
            setProjectsModalOpen,
            setShareModalOpen,
            login,
            register,
            continueAsGuest,
            logout,
            saveToCloudNow,
            loadFromCloud,
            loadSharedDoc,
            makeEditableCopy,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

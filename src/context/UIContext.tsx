// src/context/UIContext.tsx - Specialized context for UI mode, active tool, theme, settings, notifications & cloud
import React, { createContext, useContext } from 'react';
import type { AppMode, Notification } from '../logic/types';
import type { AppAction } from '../AppContext';

export interface UIContextValue {
    activeMode: AppMode;
    activeTool: string;
    documentTitle: string;
    currentFilepath?: string | null;
    themeId: string;
    activePresetId: string;
    activeIgnLayer: string;
    mapyApiKey: string;
    ignApiKey: string;
    smallRoadsOnly: boolean;
    showPoisOnMap: boolean;
    showDangersOnMap: boolean;
    showStagesOnMap: boolean;
    showAzimuthArrows: boolean;
    isLoading: boolean;
    loadingText: string;
    notifications: Notification[];
    cloudSyncStatus: 'synced' | 'pending' | 'offline' | 'error';
    cloudLastSynced: number | null;
    cloudProjectId: string | null;
    cloudShareToken: string | null;
    autosaveEnabled: boolean;
    autoCheckUpdates?: boolean;
    dispatch: React.Dispatch<AppAction>;
}

export const UIContext = createContext<UIContextValue | null>(null);

export function useUI(): UIContextValue {
    const ctx = useContext(UIContext);
    if (!ctx) {
        throw new Error('useUI must be used within an AppProvider / UIProvider');
    }
    return ctx;
}

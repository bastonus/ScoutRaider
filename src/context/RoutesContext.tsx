// src/context/RoutesContext.tsx - Specialized context for Routes, Stages & Itineraries
import React, { createContext, useContext, useMemo } from 'react';
import type { RouteDict, Itinerary, Stage, PolySegment, PolygonalisationSettings } from '../logic/types';
import type { AppAction } from '../AppContext';

export interface RoutesContextValue {
    routes: RouteDict[];
    activeRouteId: string | null;
    itineraries: Itinerary[];
    activeItineraryId: string;
    activeItinerary: Itinerary | undefined;
    stages: Stage[];
    anchorStageIdx: number;
    polygonalSteps: PolySegment[];
    polygonalLegs: Record<string, PolySegment[]>;
    polygonalSettings: PolygonalisationSettings;
    dispatch: React.Dispatch<AppAction>;
}

export const RoutesContext = createContext<RoutesContextValue | null>(null);

export function useRoutes(): RoutesContextValue {
    const ctx = useContext(RoutesContext);
    if (!ctx) {
        throw new Error('useRoutes must be used within an AppProvider / RoutesProvider');
    }
    return ctx;
}

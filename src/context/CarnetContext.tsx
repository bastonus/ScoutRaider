// src/context/CarnetContext.tsx - Specialized context for Carnet steps, manual blocks & ciphers
import React, { createContext, useContext } from 'react';
import type {
    CarnetStep,
    CarnetView,
    AnnexeId,
    NavLanguage,
    POIResult
} from '../logic/types';
import type { AppAction } from '../AppContext';

export interface CarnetContextValue {
    carnetSteps: CarnetStep[];
    carnetView: CarnetView;
    carnetIncludeGeneralMap: boolean;
    carnetIncludeElevationProfile?: boolean;
    enabledAnnexes: AnnexeId[];
    disabledAnnexes?: AnnexeId[];
    customAssignments: Record<string, string>;
    customLanguages: Record<string, NavLanguage>;
    segmentPois: Record<string, POIResult[]>;
    dispatch: React.Dispatch<AppAction>;
}

export const CarnetContext = createContext<CarnetContextValue | null>(null);

export function useCarnet(): CarnetContextValue {
    const ctx = useContext(CarnetContext);
    if (!ctx) {
        throw new Error('useCarnet must be used within an AppProvider / CarnetProvider');
    }
    return ctx;
}

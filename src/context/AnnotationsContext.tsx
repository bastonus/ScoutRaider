// src/context/AnnotationsContext.tsx - Specialized context for Annotations, Layers & Draw
import React, { createContext, useContext } from 'react';
import type {
    AnnotationLayerDef,
    PointAnnotation,
    AreaAnnotation,
    DrawAnnotation,
    TextAnnotation
} from '../logic/types';
import type { AppAction } from '../AppContext';

export interface AnnotationsContextValue {
    annotationLayers: AnnotationLayerDef[];
    pointAnnotations: PointAnnotation[];
    areaAnnotations: AreaAnnotation[];
    drawAnnotations: DrawAnnotation[];
    textAnnotations: TextAnnotation[];
    layerOrder: Array<{ kind: 'itin' | 'point' | 'area' | 'draw' | 'text'; id: string }>;
    selectedLayerId: string | null;
    selectedSublayerId: string | null;
    dispatch: React.Dispatch<AppAction>;
}

export const AnnotationsContext = createContext<AnnotationsContextValue | null>(null);

export function useAnnotations(): AnnotationsContextValue {
    const ctx = useContext(AnnotationsContext);
    if (!ctx) {
        throw new Error('useAnnotations must be used within an AppProvider / AnnotationsProvider');
    }
    return ctx;
}

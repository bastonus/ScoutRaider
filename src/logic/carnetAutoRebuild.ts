// src/logic/carnetAutoRebuild.ts - Rebuilding carnet steps, text regeneration and merging
import type { AppState, CarnetStep } from './types';
import { presetsManager } from './PresetsManager';
import { themeManager } from './ThemeManager';
import { Orchestrator } from './Orchestrator';
import { CarnetEngine } from './CarnetEngine';
import { ConstraintChecker } from './ConstraintChecker';
import { NavigationText } from './NavigationText';
import { ModuleLogic } from './ModuleLogic';

// ── AUTO-MERGE: If two adjacent steps have the same module, fuse them ──
export function autoMergeSteps(steps: CarnetStep[]): CarnetStep[] {
    if (steps.length <= 1) return steps;

    const isMapModule = (mod: string) => ['carte_ign', 'carte_simple', 'drapeaux'].includes(mod);

    const merged: CarnetStep[] = [steps[0]];
    for (let i = 1; i < steps.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = steps[i];

        const bothMaps = !prev.isManual && !curr.isManual && isMapModule(prev.moduleId) && isMapModule(curr.moduleId);
        const sameNonMapModule = !prev.isManual && !curr.isManual && !isMapModule(prev.moduleId) && prev.moduleId === curr.moduleId;

        if (bothMaps || sameNonMapModule) {
            let combinedCoords = prev.coords || [];
            if (curr.coords && curr.coords.length > 0) {
                if (combinedCoords.length > 0 &&
                    Math.abs(combinedCoords[combinedCoords.length - 1][0] - curr.coords[0][0]) < 0.00001 &&
                    Math.abs(combinedCoords[combinedCoords.length - 1][1] - curr.coords[0][1]) < 0.00001) {
                    combinedCoords = [...combinedCoords, ...curr.coords.slice(1)];
                } else {
                    combinedCoords = [...combinedCoords, ...curr.coords];
                }
            }

            merged[merged.length - 1] = {
                ...prev,
                moduleId: bothMaps ? 'carte_ign' : prev.moduleId,
                toLabel: curr.toLabel || prev.toLabel,
                distanceM: prev.distanceM + curr.distanceM,
                coords: combinedCoords,
                segmentIndices: [...(prev.segmentIndices || []), ...(curr.segmentIndices || [])],
                solutionText: (prev.solutionText && curr.solutionText) ? (prev.solutionText + '\n' + curr.solutionText) : (prev.solutionText || curr.solutionText),
                encodedText: (prev.encodedText && curr.encodedText) ? (prev.encodedText + '\n' + curr.encodedText) : (prev.encodedText || curr.encodedText),
                warnings: [...(prev.warnings || []), ...(curr.warnings || [])],
                mapPersist: prev.mapPersist || curr.mapPersist,
            };
        } else {
            merged.push(curr);
        }
    }
    return merged;
}

export function autoRebuildCarnet(state: AppState): AppState {
    const activePresetData = presetsManager.activePreset;
    if (!activePresetData || state.polygonal_steps.length === 0) return state;

    const orchestrator = new Orchestrator(
        state.polygonal_steps,
        activePresetData.weights,
        activePresetData.overrides,
        state.custom_assignments
    );

    const assignments = orchestrator.calculateAssignments();
    const plan = orchestrator.generateExportPlan();

    const updatedPolySteps = state.polygonal_steps.map((seg, idx) => {
        const segPois = state.segment_pois?.[idx.toString()] || [];
        const selected = segPois.find(p => p.selected) || segPois[0] || null;
        return {
            ...seg,
            assigned_module: assignments[idx.toString()] || 'texte_clair',
            poi: selected ? { name: selected.name, type: 'landmark', distance_m: 0 } : seg.poi
        };
    });

    const newComputedSteps = CarnetEngine.generateStepsFromPlan(
        plan,
        updatedPolySteps,
        state.stages,
        activePresetData
    );

    const violations = ConstraintChecker.validate(state.polygonal_steps, assignments, activePresetData);

    newComputedSteps.forEach(step => {
        step.warnings = violations
            .filter(v => assignments[v.seg_idx.toString()] === step.moduleId)
            .map((v, i) => ({
                id: `v-${i}`,
                stepId: step.id,
                severity: v.level,
                rule: 'Constraint',
                message: v.message,
                detail: v.explanation
            }));
    });

    // Preserving old properties
    const oldSteps = state.carnet_steps;
    
    let finalSteps = newComputedSteps.map(newStep => {
        if (!newStep.segmentIndices || newStep.segmentIndices.length === 0) return newStep;
        const firstSegIdx = newStep.segmentIndices[0];
        
        // Pull latest POIs from state for this segment
        if (state.segment_pois && state.segment_pois[firstSegIdx]) {
            newStep.pois = state.segment_pois[firstSegIdx];
        }

        const oldStep = oldSteps.find(s => !s.isManual && s.segmentIndices && s.segmentIndices[0] === firstSegIdx);
        if (oldStep) {
            newStep.navLanguage = oldStep.navLanguage;
            newStep.mapPersist = oldStep.mapPersist;
            
            // If the user manually edited this step, preserve their text and flag
            if (oldStep.isEdited) {
                return {
                    ...newStep,
                    isEdited: true,
                    solutionText: oldStep.solutionText,
                    encodedText: oldStep.encodedText,
                    navLanguage: oldStep.navLanguage,
                    pois: oldStep.pois, // Preserve POI selections too
                };
            }
        }
        
        // ── Cache: skip regeneration if nothing that affects the text has changed ──
        if (oldStep && oldStep.solutionText) {
            const oldSelectedPoi = oldStep.pois?.find((p: any) => p.selected);
            const newSelectedPoi = newStep.pois?.find((p: any) => p.selected);
            
            // Build cache key from all inputs that affect the output text
            const cacheInputs = [
                newStep.moduleId,
                newStep.navLanguage ?? '',
                newSelectedPoi?.id ?? '',
                state.theme_id,
                // All segments' azimut+distance
                ...newStep.segmentIndices.map(i => {
                    const s = state.polygonal_steps[i];
                    return s ? `${Math.round(s.azimut ?? 0)},${Math.round(s.distance ?? 0)}` : '?';
                })
            ].join('|');

            const oldCacheInputs = [
                oldStep.moduleId,
                oldStep.navLanguage ?? '',
                oldSelectedPoi?.id ?? '',
                state.theme_id,
                ...newStep.segmentIndices.map(i => {
                    const s = state.polygonal_steps[i];
                    return s ? `${Math.round(s.azimut ?? 0)},${Math.round(s.distance ?? 0)}` : '?';
                })
            ].join('|');

            if (cacheInputs === oldCacheInputs) {
                return {
                    ...newStep,
                    solutionText: oldStep.solutionText,
                    encodedText: oldStep.encodedText,
                    pois: oldStep.pois, // Preserve POI selections
                };
            }
        }
        
        return regenerateStepTexts(newStep, state);
    });

    // Extract all manual steps (including inline ones)
    const manualSteps = oldSteps.flatMap(s => {
        const arr = [];
        if (s.isManual) arr.push(s);
        if (s.inlineManualSteps) arr.push(...Object.values(s.inlineManualSteps));
        return arr;
    });

    manualSteps.forEach(manualStep => {
        const oldIndex = oldSteps.findIndex(s => s.id === manualStep.id);

        if (manualStep.anchorSegmentIdx !== undefined && manualStep.anchorSegmentIdx >= 0) {
            const newIndex = finalSteps.findIndex(
                s => !s.isManual && s.segmentIndices?.includes(manualStep.anchorSegmentIdx!)
            );
            if (newIndex !== -1) {
                const step = finalSteps[newIndex];
                const segs = step.segmentIndices!;
                if (segs[segs.length - 1] === manualStep.anchorSegmentIdx) {
                    finalSteps.splice(newIndex + 1, 0, manualStep);
                } else {
                    if (!step.inlineManualSteps) step.inlineManualSteps = {};
                    step.inlineManualSteps[manualStep.anchorSegmentIdx] = manualStep;
                }
                return;
            }
        }

        if (oldIndex > 0) {
            let precedingComputedStep = null;
            for (let i = oldIndex - 1; i >= 0; i--) {
                if (!oldSteps[i].isManual) {
                    precedingComputedStep = oldSteps[i];
                    break;
                }
            }
            if (precedingComputedStep && precedingComputedStep.segmentIndices && precedingComputedStep.segmentIndices.length > 0) {
                const lastSegIdx = precedingComputedStep.segmentIndices[precedingComputedStep.segmentIndices.length - 1];
                const newIndex = finalSteps.findIndex(s => !s.isManual && s.segmentIndices?.includes(lastSegIdx));
                if (newIndex !== -1) {
                    finalSteps.splice(newIndex + 1, 0, manualStep);
                } else {
                    finalSteps.push(manualStep);
                }
            } else {
                finalSteps.unshift(manualStep);
            }
        } else {
            finalSteps.unshift(manualStep);
        }
    });

    const usedModules = new Set(finalSteps.map(s => s.moduleId));
    const MODULE_TO_ANNEXE: Record<string, string | undefined> = {
        morse: 'alphabet_morse',
        polybe: 'grille_polybe',
        vigenere: 'tableau_vigenere',
        maritime: 'index_drapeaux',
        templier: 'code_templier',
        avocat: 'methode_avocat',
        gilwell: 'alphabet_gilwell',
    };
    
    let newAnnexes = new Set(state.enabled_annexes || []);
    usedModules.forEach(mod => {
        const annexe = MODULE_TO_ANNEXE[mod];
        if (annexe) newAnnexes.add(annexe as any);
    });

    // Always merge consecutive map steps so they are never split in the editor
    finalSteps = autoMergeSteps(finalSteps);

    return { 
        ...state, 
        carnet_steps: finalSteps, 
        polygonal_steps: updatedPolySteps,
        enabled_annexes: Array.from(newAnnexes)
    };
}

export function regenerateStepTexts(step: CarnetStep, state: AppState): CarnetStep {
    if (step.isManual) {
        const _t = themeManager.getTheme(state.theme_id);
        const src = step.solutionText || step.encodedText;
        return {
            ...step,
            solutionText: src,
            encodedText: ModuleLogic.encode(step.moduleId, src, { key: _t.vigenere_key })
        };
    }

    const theme = themeManager.getTheme(state.theme_id);

    if (!step.segmentIndices || step.segmentIndices.length === 0) return step;

    const segments = step.segmentIndices.map(idx => state.polygonal_steps[idx]).filter(Boolean);

    const navTexts = segments.map((seg, idx) => {
        const globalIdx = step.segmentIndices![idx];
        const prevAzimuth = globalIdx > 0 ? state.polygonal_steps[globalIdx - 1].azimut : undefined;
        // Fetch segment-specific POIs
        const segPois = state.segment_pois?.[globalIdx.toString()];
        const segSelectedPoi = segPois?.find(p => p.selected);
        const poiName = segSelectedPoi ? segSelectedPoi.name : (seg.poi?.name || null);
        const poiType = segSelectedPoi ? 'landmark' : (seg.poi?.type || 'landmark');
        const poiObj = poiName ? { name: poiName, type: poiType } : null;

        // Fetch segment-specific Language
        const segLang = state.custom_languages?.[globalIdx.toString()] || step.navLanguage;

        return NavigationText.generate(seg.distance || 0, seg.azimut || 0, poiObj, theme, prevAzimuth, segLang);
    });
    const navText = navTexts.join('\n');

    const encodedTexts = navTexts.map(text => ModuleLogic.encode(step.moduleId, text, { key: theme.vigenere_key }));
    const encodedText = encodedTexts.join('\n');

    return {
        ...step,
        solutionText: navText,
        encodedText: encodedText
    };
}

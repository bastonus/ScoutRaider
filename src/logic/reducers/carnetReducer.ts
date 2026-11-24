// src/logic/reducers/carnetReducer.ts - Reducer for Carnet steps, manual blocks, ciphers & POIs
import type { AppState, CarnetStep, ModuleId, POIResult } from '../types';
import type { AppAction } from '../../AppContext';
import { themeManager } from '../ThemeManager';
import { ModuleLogic } from '../ModuleLogic';
import { pushHistory } from '../historyManager';
import { autoRebuildCarnet, regenerateStepTexts, autoMergeSteps } from '../carnetAutoRebuild';

export function carnetReducer(state: AppState, action: AppAction): AppState | null {
    switch (action.type) {
        case 'ASSIGN_MODULES_RANGE': {
            pushHistory(state);
            const newAssignments = { ...state.custom_assignments };
            for (let i = action.startIdx; i <= action.endIdx; i++) {
                newAssignments[i.toString()] = action.moduleId;
            }
            const updatedPolySteps = state.polygonal_steps.map((seg, idx) => {
                if (idx >= action.startIdx && idx <= action.endIdx) {
                    return { ...seg, assigned_module: action.moduleId };
                }
                return seg;
            });
            return autoRebuildCarnet({
                ...state,
                custom_assignments: newAssignments,
                polygonal_steps: updatedPolySteps
            });
        }

        case 'SET_CUSTOM_ASSIGNMENTS': {
            pushHistory(state);
            return { ...state, custom_assignments: action.assignments };
        }

        case 'REBUILD_CARNET':
            return autoRebuildCarnet(state);

        case 'TOGGLE_ANNEXE': {
            pushHistory(state);
            const disabled = new Set(state.disabled_annexes || []);
            if (disabled.has(action.annexeId)) {
                disabled.delete(action.annexeId);
            } else {
                disabled.add(action.annexeId);
            }
            return {
                ...state,
                disabled_annexes: Array.from(disabled)
            };
        }

        case 'SET_CARNET_VIEW':
            return { ...state, carnet_view: action.view };

        case 'TOGGLE_GENERAL_MAP':
            return { ...state, carnet_include_general_map: !state.carnet_include_general_map };

        case 'TOGGLE_ELEVATION_PROFILE':
            return { ...state, carnet_include_elevation_profile: !(state.carnet_include_elevation_profile ?? true) };

        case 'MANUAL_MODULE_ASSIGNMENT': {
            pushHistory(state);
            const stepToChange = state.carnet_steps.find(s => s.id === action.stepId);

            if (stepToChange && stepToChange.isManual) {
                const newSteps = state.carnet_steps.map(s => {
                    if (s.id !== action.stepId) return s;
                    return regenerateStepTexts({ ...s, moduleId: action.moduleId as ModuleId }, state);
                });
                return { ...state, carnet_steps: autoMergeSteps(newSteps) };
            }

            let inlineFound = false;
            const updatedStepsWithInline = state.carnet_steps.map(s => {
                if (s.inlineManualSteps) {
                    let changed = false;
                    const newInline = { ...s.inlineManualSteps };
                    for (const [k, v] of Object.entries(newInline)) {
                        if (v.id === action.stepId) {
                            newInline[k as any] = regenerateStepTexts({ ...v, moduleId: action.moduleId as ModuleId }, state);
                            changed = true;
                            inlineFound = true;
                        }
                    }
                    if (changed) return { ...s, inlineManualSteps: newInline };
                }
                return s;
            });
            if (inlineFound) {
                return { ...state, carnet_steps: updatedStepsWithInline };
            }

            if (!stepToChange) return state;

            const newAssignments = { ...state.custom_assignments };
            const polySteps = [...state.polygonal_steps];
            if (stepToChange.segmentIndices) {
                stepToChange.segmentIndices.forEach(idx => {
                    newAssignments[idx.toString()] = action.moduleId;
                    if (polySteps[idx]) {
                        polySteps[idx] = { ...polySteps[idx], assigned_module: action.moduleId as ModuleId };
                    }
                });
            }
            const nextState = { ...state, custom_assignments: newAssignments, polygonal_steps: polySteps };
            return autoRebuildCarnet(nextState);
        }

        case 'UPDATE_MANUAL_TEXT': {
            const _theme1 = themeManager.getTheme();

            return {
                ...state,
                carnet_steps: state.carnet_steps.map(s => {
                    if (s.id === action.stepId) {
                        const encoded = ModuleLogic.encode(s.moduleId, action.text, { key: _theme1.vigenere_key });
                        return { ...s, solutionText: action.text, encodedText: encoded };
                    }
                    if (s.inlineManualSteps) {
                        let changed = false;
                        const newInline = { ...s.inlineManualSteps };
                        for (const [k, v] of Object.entries(newInline)) {
                            if (v.id === action.stepId) {
                                const encoded = ModuleLogic.encode(v.moduleId, action.text, { key: _theme1.vigenere_key });
                                newInline[k as any] = { ...v, solutionText: action.text, encodedText: encoded };
                                changed = true;
                            }
                        }
                        if (changed) return { ...s, inlineManualSteps: newInline };
                    }
                    return s;
                })
            };
        }

        case 'LOCK_DOCUMENT_TITLE':
            return state;

        case 'INSERT_MANUAL_STEP': {
            pushHistory(state);
            const afterIdx = state.carnet_steps.findIndex(s => s.id === action.afterStepId);

            let anchorSegmentIdx: number = -1;
            if (afterIdx >= 0) {
                for (let i = afterIdx; i >= 0; i--) {
                    const s = state.carnet_steps[i];
                    if (!s.isManual && s.segmentIndices && s.segmentIndices.length > 0) {
                        anchorSegmentIdx = s.segmentIndices[s.segmentIndices.length - 1];
                        break;
                    }
                }
            }

            const manualStep: CarnetStep = {
                id: `manual-${Date.now()}`,
                fromLabel: '',
                toLabel: '',
                moduleId: 'texte_clair',
                distanceM: 0,
                azimuth: 0,
                coords: [],
                solutionText: action.content,
                encodedText: action.content,
                warnings: [],
                isManual: true,
                anchorSegmentIdx,
            };
            const newSteps = [...state.carnet_steps];
            newSteps.splice(afterIdx + 1, 0, manualStep);
            return { ...state, carnet_steps: newSteps };
        }

        case 'REMOVE_MANUAL_STEP': {
            pushHistory(state);
            return {
                ...state,
                carnet_steps: state.carnet_steps.filter(s => s.id !== action.stepId).map(s => {
                    if (s.inlineManualSteps) {
                        const newInline = { ...s.inlineManualSteps };
                        let changed = false;
                        for (const key of Object.keys(newInline)) {
                            if (newInline[key as any].id === action.stepId) {
                                delete newInline[key as any];
                                changed = true;
                            }
                        }
                        if (changed) return { ...s, inlineManualSteps: newInline };
                    }
                    return s;
                })
            };
        }

        case 'INSERT_MANUAL_STEP_TYPED': {
            pushHistory(state);
            let anchorSegmentIdxT: number = -1;
            const afterIdxT = state.carnet_steps.findIndex(s => s.id === action.afterStepId);

            if (action.anchorSegmentIdx !== undefined) {
                anchorSegmentIdxT = action.anchorSegmentIdx;
            } else if (afterIdxT >= 0) {
                for (let i = afterIdxT; i >= 0; i--) {
                    const s = state.carnet_steps[i];
                    if (!s.isManual && s.segmentIndices && s.segmentIndices.length > 0) {
                        anchorSegmentIdxT = s.segmentIndices[s.segmentIndices.length - 1];
                        break;
                    }
                }
            }
            const theme_t = themeManager.getTheme(state.theme_id);
            const modId = (action.moduleId || 'texte_clair') as ModuleId;
            const encoded_t = action.manualType === 'code'
                ? ModuleLogic.encode(modId, action.content, { key: theme_t.vigenere_key })
                : action.content;
            const typedStep: CarnetStep = {
                id: `manual-${Date.now()}`,
                fromLabel: '', toLabel: '',
                moduleId: modId,
                distanceM: 0, azimuth: 0, coords: [],
                solutionText: action.content,
                encodedText: encoded_t,
                warnings: [],
                isManual: true,
                manualType: action.manualType,
                anchorSegmentIdx: anchorSegmentIdxT,
            };
            const stepsT = [...state.carnet_steps];
            stepsT.splice(afterIdxT + 1, 0, typedStep);
            return autoRebuildCarnet({ ...state, carnet_steps: stepsT });
        }

        case 'CONVERT_MANUAL_STEP_TYPE': {
            pushHistory(state);
            const theme_c = themeManager.getTheme(state.theme_id);
            const updateStep = (s: CarnetStep): CarnetStep => {
                if (s.id !== action.stepId) return s;
                if (action.targetType === 'code') {
                    const rawText = (s.solutionText || '')
                        .replace(/<p[^>]*>/gi, '')
                        .replace(/<\/p>/gi, '\n')
                        .replace(/<br\s*[\/]?>/gi, '\n')
                        .replace(/<[^>]+>/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .trim();
                    const modId = (action.moduleId || (s.moduleId && s.moduleId !== 'texte_clair' ? s.moduleId : 'morse')) as ModuleId;
                    const encoded = ModuleLogic.encode(modId, rawText, { key: theme_c.vigenere_key });
                    return {
                        ...s,
                        manualType: 'code',
                        moduleId: modId,
                        solutionText: rawText,
                        encodedText: encoded,
                    };
                } else {
                    const rawText = s.solutionText || '';
                    const htmlContent = rawText.startsWith('<p>')
                        ? rawText
                        : (rawText ? `<p>${rawText.replace(/\n/g, '<br>')}</p>` : '');
                    return {
                        ...s,
                        manualType: 'html',
                        moduleId: 'texte_clair',
                        solutionText: htmlContent,
                        encodedText: htmlContent,
                    };
                }
            };

            const newSteps = state.carnet_steps.map(s => {
                if (s.id === action.stepId) return updateStep(s);
                if (s.inlineManualSteps) {
                    let changed = false;
                    const newInline = { ...s.inlineManualSteps };
                    for (const [k, v] of Object.entries(newInline)) {
                        if (v.id === action.stepId) {
                            newInline[k as any] = updateStep(v);
                            changed = true;
                        }
                    }
                    if (changed) return { ...s, inlineManualSteps: newInline };
                }
                return s;
            });

            return autoRebuildCarnet({ ...state, carnet_steps: newSteps });
        }

        case 'EDIT_COMPUTED_TEXT': {
            const theme_e = themeManager.getTheme(state.theme_id);
            return {
                ...state,
                carnet_steps: state.carnet_steps.map(s => {
                    if (s.id !== action.stepId || s.isManual) return s;
                    let newText = action.newSolutionText;
                    
                    if (action.lineIdx !== undefined) {
                        const lines = (s.solutionText || '').split('\n').filter(Boolean);
                        if (action.lineIdx >= 0 && action.lineIdx < lines.length) {
                            lines[action.lineIdx] = newText;
                            newText = lines.join('\n');
                        }
                    }

                    const DIRECTIONAL_KEYWORDS = ['tournez', 'tourner', 'prenez', 'allez', 'gauche', 'droite', 'continuez'];
                    const lowerNew = newText.toLowerCase();
                    const seemsDirectional = DIRECTIONAL_KEYWORDS.some(kw => lowerNew.includes(kw));

                    let newNavLang = s.navLanguage;
                    if (seemsDirectional && (s.navLanguage === 'Azimut' || !s.navLanguage)) {
                        newNavLang = 'Tournant';
                    }

                    const lines = newText.split('\n');
                    const encodedLines = lines.map(t => ModuleLogic.encode(s.moduleId, t, { key: theme_e.vigenere_key }));
                    const encoded_e = encodedLines.join('\n');

                    return {
                        ...s,
                        solutionText: newText,
                        encodedText: encoded_e,
                        navLanguage: newNavLang,
                        isEdited: true,
                        warnings: [],
                    };
                })
            };
        }

        case 'PERSIST_MAP_STATE': {
            return {
                ...state,
                carnet_steps: state.carnet_steps.map(s => {
                    if (s.id !== action.stepId) return s;
                    return {
                        ...s,
                        mapPersist: {
                            ...s.mapPersist,
                            zoom: action.zoom !== undefined ? action.zoom : (s.mapPersist?.zoom ?? 15),
                            center: action.center !== undefined ? action.center : (s.mapPersist?.center ?? [0, 0]),
                            bounds: action.bounds !== undefined ? action.bounds : s.mapPersist?.bounds,
                            height: action.height !== undefined ? action.height : s.mapPersist?.height,
                            width: action.width !== undefined ? action.width : s.mapPersist?.width,
                            widthPercent: action.widthPercent !== undefined ? action.widthPercent : s.mapPersist?.widthPercent,
                            alignment: action.alignment !== undefined ? action.alignment : s.mapPersist?.alignment,
                            scaleName: action.scaleName !== undefined ? action.scaleName : s.mapPersist?.scaleName,
                            layerId: action.layerId !== undefined ? action.layerId : s.mapPersist?.layerId,
                            isLocked: action.isLocked !== undefined ? action.isLocked : s.mapPersist?.isLocked,
                            showRoute: action.showRoute !== undefined ? action.showRoute : s.mapPersist?.showRoute,
                            showEndpoints: action.showEndpoints !== undefined ? action.showEndpoints : s.mapPersist?.showEndpoints,
                            showAnnotations: action.showAnnotations !== undefined ? action.showAnnotations : s.mapPersist?.showAnnotations,
                        }
                    };
                })
            };
        }

        case 'SET_NAV_LANGUAGE': {
            if (action.segIdx !== undefined) {
                const newLangs = { ...state.custom_languages };
                if (action.lang) newLangs[action.segIdx.toString()] = action.lang;
                else delete newLangs[action.segIdx.toString()];
                return autoRebuildCarnet({ ...state, custom_languages: newLangs });
            }
            if (action.stepId) {
                return {
                    ...state,
                    carnet_steps: state.carnet_steps.map(s => {
                        if (s.id !== action.stepId) return s;
                        return regenerateStepTexts({ ...s, navLanguage: action.lang }, state);
                    })
                };
            }
            return state;
        }

        case 'TOGGLE_POI': {
            if (action.segIdx !== undefined && state.segment_pois) {
                const segPois = state.segment_pois[action.segIdx.toString()] || [];
                const wasSelected = segPois.find(p => p.id === action.poiId)?.selected;
                const updatedPois = segPois.map(p =>
                    p.id === action.poiId
                        ? { ...p, selected: !wasSelected }
                        : { ...p, selected: false }
                );
                const selected = updatedPois.find(p => p.selected) || null;
                const newPolySteps = [...state.polygonal_steps];
                if (newPolySteps[action.segIdx]) {
                    newPolySteps[action.segIdx] = {
                        ...newPolySteps[action.segIdx],
                        poi: selected ? { name: selected.name, type: 'landmark', distance_m: 0 } : null
                    };
                }
                const newSegmentPois = { ...state.segment_pois, [action.segIdx.toString()]: updatedPois };
                return autoRebuildCarnet({ ...state, segment_pois: newSegmentPois, polygonal_steps: newPolySteps });
            }
            if (action.stepId) {
                return {
                    ...state,
                    carnet_steps: state.carnet_steps.map(s => {
                        if (s.id !== action.stepId || !s.pois) return s;
                        const wasSelected = s.pois.find(p => p.id === action.poiId)?.selected;
                        const updatedPois = s.pois.map(p =>
                            p.id === action.poiId
                                ? { ...p, selected: !wasSelected }
                                : { ...p, selected: false }
                        );
                        return regenerateStepTexts({ ...s, pois: updatedPois }, state);
                    })
                };
            }
            return state;
        }

        case 'SET_SEGMENT_POIS': {
            const newSegmentPois = action.segment_pois as Record<string, POIResult[]>;
            return autoRebuildCarnet({ ...state, segment_pois: newSegmentPois });
        }

        default:
            return null;
    }
}

/**
 * Orchestrator.ts — Core logic for assigning encoding modules to segments.
 * Ported from legacy/main_orchestrator.py
 */

import { ModuleRegistry, ALL_MODULE_IDS } from './ModuleRegistry';
import type { PolySegment, PresetOverrides, ModuleId, PathPlanEntry } from './types';

export class Orchestrator {
    private segments: PolySegment[];
    private weights: Record<string, number>;
    private overrides: Record<string, PresetOverrides>;
    private manualAssignments: Record<string, string>;
    private history: ModuleId[];
    public assignments: Record<string, string>;

    constructor(
        segments: PolySegment[],
        weights: Record<string, number>,
        overrides: Record<string, PresetOverrides>,
        manualAssignments: Record<string, string>
    ) {
        this.segments = segments;
        this.weights = weights;
        this.overrides = overrides;
        this.manualAssignments = manualAssignments;
        this.history = [];
        this.assignments = {};
    }

    /**
     * Recomputes all module assignments based on constraints and weights.
     */
    calculateAssignments(): Record<string, string> {
        const n = this.segments.length;
        if (n === 0) return {};

        this.history = [];
        this.assignments = {};
        
        let consecutiveWritten = 0;
        
        const enabledModules = ModuleRegistry.getEnabledModules(this.weights);
        const unusedModules = new Set<ModuleId>(enabledModules);

        for (let i = 0; i < n; i++) {
            // Already assigned as part of a multi-segment group?
            if (this.assignments[String(i)]) {
                continue;
            }

            // User overrides take absolute precedence
            if (this.manualAssignments[String(i)] && this.manualAssignments[String(i)] !== 'unassigned') {
                this.assignments[String(i)] = this.manualAssignments[String(i)];
                this.history.push(this.assignments[String(i)] as ModuleId);
                
                if (ModuleRegistry.getType(this.assignments[String(i)] as ModuleId) === 'written') {
                    consecutiveWritten++;
                } else {
                    consecutiveWritten = 0;
                }
                
                unusedModules.delete(this.assignments[String(i)] as ModuleId);
                continue;
            }

            // Start algorithmic assignment
            
            // Handle last segment (must be IGN if enabled)
            if (i === n - 1 && enabledModules.includes('carte_ign') && !this.history.includes('carte_ign')) {
                const [fits, count] = ModuleRegistry.evaluate('carte_ign', i, this.segments, this.overrides['carte_ign'], this.history);
                if (fits) {
                    this.assignSegment(i, count, 'carte_ign');
                    continue;
                }
            }

            let validModules = enabledModules.filter(m => {
                const [fits] = ModuleRegistry.evaluate(m, i, this.segments, this.overrides[m], this.history);
                if (!fits) return false;

                // Prevent too many consecutive written modules
                if (ModuleRegistry.getType(m) === 'written' && consecutiveWritten >= 3) {
                    // Only exception: texte_clair is allowed
                    if (m !== 'texte_clair') return false;
                }
                
                return true;
            });

            // "Exhaustivity" rule: if a module hasn't been used yet, try to force it
            const validUnused = validModules.filter(m => unusedModules.has(m));
            if (validUnused.length > 0) {
                // If there's an unused module that MUST be used, bump its weight significantly
                // (Simplified logic here: we pick the first valid unused that has high weight or just pick randomly)
                // In Python we manipulated weights dynamically. Here we'll just temporarily boost.
                validModules = validUnused; 
            }

            // Weighted random selection
            let selectedModule: ModuleId = 'texte_clair';
            
            if (validModules.length > 0) {
                const totalWeight = validModules.reduce((acc, m) => acc + (this.weights[m] || 1), 0);
                if (totalWeight > 0) {
                    let r = Math.random() * totalWeight;
                    for (const m of validModules) {
                        r -= (this.weights[m] || 1);
                        if (r <= 0) {
                            selectedModule = m;
                            break;
                        }
                    }
                } else {
                    selectedModule = validModules[Math.floor(Math.random() * validModules.length)];
                }
            }

            // How many segments does it cover?
            const [_, count] = ModuleRegistry.evaluate(selectedModule, i, this.segments, this.overrides[selectedModule], this.history);
            
            this.assignSegment(i, Math.max(1, count), selectedModule);
            
            if (ModuleRegistry.getType(selectedModule) === 'written') {
                consecutiveWritten += Math.max(1, count);
            } else {
                consecutiveWritten = 0;
            }
            unusedModules.delete(selectedModule);
        }

        return this.assignments;
    }

    private assignSegment(startIdx: number, count: number, moduleId: ModuleId) {
        for (let j = 0; j < count; j++) {
            this.assignments[String(startIdx + j)] = moduleId;
        }
        this.history.push(moduleId);
    }

    /**
     * Generates a step-by-step path plan grouping identical adjacent modules.
     * Exported components will use this.
     */
    generateExportPlan(): PathPlanEntry[] {
        const plan: PathPlanEntry[] = [];
        let i = 0;
        const n = this.segments.length;

        while (i < n) {
            const mod = this.assignments[String(i)] || 'texte_clair';
            if (mod === 'unassigned' || mod === '--- Ignorer ---') {
                i++;
                continue;
            }

            let count = 1;
            while (i + count < n && this.assignments[String(i + count)] === mod) {
                count++;
                
                // Smart splitting limitations
                if (mod === 'gilwell' && count >= 7) break; // Max 7 azimuts per Gilwell diagram
                if ((mod === 'carte_ign' || mod === 'maritime') && count >= 5) break; 
            }

            plan.push([mod, i, count]);
            i += count;
        }

        return plan;
    }
}

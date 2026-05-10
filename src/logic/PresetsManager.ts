/**
 * PresetsManager.ts — Difficulty preset management.
 * Ported from legacy/utils/presets_manager.py
 */
import type { PresetsFile, PresetData, PresetOverrides, CategoryConstraints } from './types';

export class PresetsManager {
    private data: PresetsFile = { active_preset: null, factory: {}, custom: {} };
    private _activeId: string | null = null;
    private _activeData: PresetData | null = null;
    private _loaded = false;

    get isLoaded(): boolean { return this._loaded; }
    get activePresetId(): string | null { return this._activeId; }
    get activePreset(): PresetData | null { return this._activeData; }

    async load(): Promise<void> {
        try {
            const res = await fetch('config/presets.json');
            this.data = await res.json();
            this._activeId = this.data.active_preset;
            this.resolveActivePreset();
            this._loaded = true;
        } catch (e) {
            console.error('Failed to load presets.json:', e);
            this._loaded = true;
        }
    }

    private resolveActivePreset(): void {
        if (!this._activeId) {
            this._activeData = null;
            return;
        }
        this._activeData =
            this.data.factory[this._activeId] ||
            this.data.custom[this._activeId] ||
            null;

        if (!this._activeData) {
            console.warn(`Preset '${this._activeId}' not found.`);
        }
    }

    /** Get polygonalisation settings from the active preset */
    getPolygonalisationSettings(): {
        tolerance_angle: number;
        hors_piste: boolean;
        forcer_carrefours: boolean;
    } {
        if (!this._activeData?.polygonalisation) {
            return { tolerance_angle: 20, hors_piste: false, forcer_carrefours: true };
        }
        return this._activeData.polygonalisation;
    }

    /** Get the weight dictionary from the active preset */
    getWeights(): Record<string, number> {
        return this._activeData?.weights || {};
    }

    /** Get per-module overrides from the active preset */
    getOverrides(moduleName: string): PresetOverrides {
        return this._activeData?.overrides?.[moduleName] || {};
    }

    /** Merge base category constraints with preset overrides */
    applyOverridesToCategory(
        moduleName: string,
        categoryData: CategoryConstraints
    ): CategoryConstraints {
        const overrides = this.getOverrides(moduleName);
        if (!Object.keys(overrides).length) return categoryData;
        return { ...categoryData, ...overrides };
    }

    /** Switch to a different preset */
    setActivePreset(presetId: string): void {
        this._activeId = presetId;
        this.data.active_preset = presetId;
        this.resolveActivePreset();
    }

    /** Save a custom preset (in memory — persistence via StateManager) */
    saveCustomPreset(presetId: string, preset: PresetData): void {
        this.data.custom[presetId] = preset;
    }

    /** Remove a custom preset */
    removeCustomPreset(presetId: string): void {
        delete this.data.custom[presetId];
        if (this._activeId === presetId) {
            this._activeId = 'seconde_classe_1';
            this.data.active_preset = this._activeId;
            this.resolveActivePreset();
        }
    }

    /** Get all presets (factory + custom) for UI display */
    getAllPresets(): { id: string; name: string; isCustom: boolean }[] {
        const result: { id: string; name: string; isCustom: boolean }[] = [];
        for (const [id, data] of Object.entries(this.data.factory)) {
            result.push({ id, name: data.name, isCustom: false });
        }
        for (const [id, data] of Object.entries(this.data.custom)) {
            result.push({ id, name: data.name, isCustom: true });
        }
        return result;
    }

    /** Get raw data (for persistence) */
    toJSON(): PresetsFile {
        return this.data;
    }
}

// Singleton
export const presetsManager = new PresetsManager();

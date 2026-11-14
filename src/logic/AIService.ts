/**
 * AIService for ScoutRaider Suite (Frontend Client).
 * Communicates with the FastAPI backend AI endpoints:
 * - Narrative generation (thematic storylines)
 * - Encoded pedagogical riddles
 * - Safety & physical strain audits
 * - MCP and external connector discovery
 */

export interface AIConfig {
    provider: 'gemini' | 'claude' | 'openai' | 'ollama';
    apiKey?: string;
    modelName?: string;
    endpointUrl?: string;
    temperature?: number;
}

export interface StagePayload {
    to_label: string;
    distance_m: number;
    azimut?: number;
    poi?: string | null;
}

export interface NarrativeResponse {
    theme_title: string;
    intro_story: string;
    stage_stories: Array<{
        stage_index: number;
        title: string;
        story_snippet: string;
        moral_or_challenge?: string;
    }>;
    outro_story: string;
    suggested_music_or_atmosphere?: string;
}

export interface RiddleResponse {
    riddle_text: string;
    solution_word: string;
    encoded_solution?: string;
    pedagogical_tip?: string;
}

export interface SafetyAlert {
    severity: 'info' | 'warning' | 'critical';
    stage_index?: number;
    title: string;
    description: string;
    recommendation: string;
}

export interface SafetyAuditResponse {
    global_rating: 'safe' | 'challenging' | 'dangerous';
    summary: string;
    alerts: SafetyAlert[];
    water_points_advice: string;
    emergency_contacts_needed: string[];
}

export interface ConnectorInfo {
    id: string;
    name: string;
    description: string;
    category: string;
    requires_api_key: boolean;
    is_enabled: boolean;
    website?: string;
}

const LOCAL_STORAGE_KEY = 'scoutraider_ai_config';

export class AIService {
    private static baseUrl = 'http://localhost:8000';

    static getConfig(): AIConfig {
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.warn('Failed to parse AI config from localStorage', e);
        }
        return {
            provider: 'gemini',
            temperature: 0.7,
        };
    }

    static saveConfig(config: AIConfig): void {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
    }

    static async generateNarrative(
        theme: string,
        stages: StagePayload[],
        targetTone: 'epic' | 'mysterious' | 'scout_classic' | 'humorous' = 'epic',
        scoutBranch: 'louveteaux' | 'eclaireurs' | 'ainés' | 'patrouille_libre' = 'eclaireurs'
    ): Promise<NarrativeResponse> {
        const config = this.getConfig();
        const res = await fetch(`${this.baseUrl}/api/ai/narrative`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                theme,
                stages,
                target_tone: targetTone,
                scout_branch: scoutBranch,
                config
            })
        });

        if (!res.ok) {
            throw new Error(`AI narrative error: ${res.statusText}`);
        }
        return await res.json();
    }

    static async generateRiddle(
        poiName: string,
        poiType?: string,
        historicalHint?: string,
        targetModule: string = 'morse',
        difficulty: 'easy' | 'medium' | 'hard' = 'medium'
    ): Promise<RiddleResponse> {
        const config = this.getConfig();
        const res = await fetch(`${this.baseUrl}/api/ai/riddle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                poi_name: poiName,
                poi_type: poiType,
                historical_hint: historicalHint,
                target_module: targetModule,
                difficulty,
                config
            })
        });

        if (!res.ok) {
            throw new Error(`AI riddle error: ${res.statusText}`);
        }
        return await res.json();
    }

    static async auditSafety(
        stages: StagePayload[],
        totalDistanceKm: number,
        totalElevationGainM: number = 0,
        ageCategory: 'louveteaux' | 'eclaireurs' | 'ainés' = 'eclaireurs'
    ): Promise<SafetyAuditResponse> {
        const config = this.getConfig();
        const res = await fetch(`${this.baseUrl}/api/ai/safety-audit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stages,
                total_distance_km: totalDistanceKm,
                total_elevation_gain_m: totalElevationGainM,
                age_category: ageCategory,
                config
            })
        });

        if (!res.ok) {
            throw new Error(`Safety audit error: ${res.statusText}`);
        }
        return await res.json();
    }

    static async listConnectors(): Promise<ConnectorInfo[]> {
        const res = await fetch(`${this.baseUrl}/api/connectors`);
        if (!res.ok) return [];
        return await res.json();
    }

    static async callMCP(method: string, params: Record<string, any> = {}): Promise<any> {
        const res = await fetch(`${this.baseUrl}/api/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method,
                params
            })
        });
        if (!res.ok) throw new Error(`MCP Call Failed: ${res.statusText}`);
        return await res.json();
    }
}

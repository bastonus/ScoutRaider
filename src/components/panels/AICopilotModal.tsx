import React, { useState, useEffect } from 'react';
import { 
    X, 
    Sparkles, 
    BookOpen, 
    Key, 
    ShieldAlert, 
    Network, 
    Settings, 
    Play, 
    Check, 
    AlertTriangle, 
    ExternalLink, 
    Loader2, 
    Copy,
    Compass,
    Bot
} from 'lucide-react';
import { useApp } from '../../AppContext';
import { AIService, AIConfig, NarrativeResponse, SafetyAuditResponse, RiddleResponse, ConnectorInfo } from '../../logic/AIService';

interface AICopilotModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'narrative' | 'riddles' | 'safety' | 'mcp' | 'config';
}

export default function AICopilotModal({ isOpen, onClose, initialTab = 'narrative' }: AICopilotModalProps) {
    const { state, dispatch } = useApp();
    const [activeTab, setActiveTab] = useState<'narrative' | 'riddles' | 'safety' | 'mcp' | 'config'>(initialTab);

    // AI Config State
    const [config, setConfig] = useState<AIConfig>(() => AIService.getConfig());
    const [configSaved, setConfigSaved] = useState(false);

    // Narrative State
    const [themeInput, setThemeInput] = useState('Les Bâtisseurs de Cathédrales');
    const [targetTone, setTargetTone] = useState<'epic' | 'mysterious' | 'scout_classic' | 'humorous'>('epic');
    const [scoutBranch, setScoutBranch] = useState<'louveteaux' | 'eclaireurs' | 'ainés' | 'patrouille_libre'>('eclaireurs');
    const [narrativeLoading, setNarrativeLoading] = useState(false);
    const [narrativeResult, setNarrativeResult] = useState<NarrativeResponse | null>(null);

    // Riddles State
    const [selectedPoi, setSelectedPoi] = useState(state.pois?.[0]?.name || 'Abbaye en ruines');
    const [riddleModule, setRiddleModule] = useState('morse');
    const [riddleDifficulty, setRiddleDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
    const [riddleLoading, setRiddleLoading] = useState(false);
    const [riddleResult, setRiddleResult] = useState<RiddleResponse | null>(null);

    // Safety Audit State
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditResult, setAuditResult] = useState<SafetyAuditResponse | null>(null);

    // MCP & Connectors State
    const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
    const [connectorsLoading, setConnectorsLoading] = useState(false);
    const [copiedMcpConfig, setCopiedMcpConfig] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
            loadConnectors();
        }
    }, [isOpen, initialTab]);

    const loadConnectors = async () => {
        setConnectorsLoading(true);
        try {
            const list = await AIService.listConnectors();
            setConnectors(list);
        } catch (e) {
            console.error('Failed to load connectors', e);
        } finally {
            setConnectorsLoading(false);
        }
    };

    if (!isOpen) return null;

    // Collect current stages info
    const stagesPayload = (state.stages || []).map((st, idx) => ({
        to_label: st.label || `Balise ${idx + 1}`,
        distance_m: 1200, // Estimated or calculated distance
        poi: st.poi || null
    }));

    const totalKm = (stagesPayload.length * 1.2) || 8.5;

    const handleSaveConfig = () => {
        AIService.saveConfig(config);
        setConfigSaved(true);
        setTimeout(() => setConfigSaved(false), 2000);
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Configuration IA enregistrée !', notifType: 'info' });
    };

    const handleGenerateNarrative = async () => {
        setNarrativeLoading(true);
        try {
            const res = await AIService.generateNarrative(themeInput, stagesPayload, targetTone, scoutBranch);
            setNarrativeResult(res);
            dispatch({ type: 'ADD_NOTIFICATION', message: `Scénario "${res.theme_title}" généré avec succès !`, notifType: 'info' });
        } catch (e: any) {
            dispatch({ type: 'ADD_NOTIFICATION', message: `Erreur IA: ${e.message}`, notifType: 'error' });
        } finally {
            setNarrativeLoading(false);
        }
    };

    const handleGenerateRiddle = async () => {
        setRiddleLoading(true);
        try {
            const res = await AIService.generateRiddle(selectedPoi, 'monument', undefined, riddleModule, riddleDifficulty);
            setRiddleResult(res);
            dispatch({ type: 'ADD_NOTIFICATION', message: `Énigme pour ${selectedPoi} générée !`, notifType: 'info' });
        } catch (e: any) {
            dispatch({ type: 'ADD_NOTIFICATION', message: `Erreur énigme: ${e.message}`, notifType: 'error' });
        } finally {
            setRiddleLoading(false);
        }
    };

    const handleRunSafetyAudit = async () => {
        setAuditLoading(true);
        try {
            const res = await AIService.auditSafety(stagesPayload, totalKm, 280, 'eclaireurs');
            setAuditResult(res);
            dispatch({ type: 'ADD_NOTIFICATION', message: `Audit de sécurité terminé : statut ${res.global_rating}`, notifType: 'info' });
        } catch (e: any) {
            dispatch({ type: 'ADD_NOTIFICATION', message: `Erreur audit: ${e.message}`, notifType: 'error' });
        } finally {
            setAuditLoading(false);
        }
    };

    const copyMcpConfigToClipboard = () => {
        const mcpSnippet = JSON.stringify({
            "mcpServers": {
                "scoutraider": {
                    "url": "http://localhost:8000/api/mcp",
                    "transport": "http"
                }
            }
        }, null, 2);
        navigator.clipboard.writeText(mcpSnippet);
        setCopiedMcpConfig(true);
        setTimeout(() => setCopiedMcpConfig(false), 2000);
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Configuration MCP copiée dans le presse-papier !', notifType: 'info' });
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '850px',
                height: '80vh',
                maxHeight: '750px',
                backgroundColor: 'var(--bg-canvas, #18191c)',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(255,255,255,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            padding: '6px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            display: 'flex'
                        }}>
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Copilote IA & Hub Connecteurs MCP
                                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 600 }}>
                                    v1.0
                                </span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-dim, #888)' }}>
                                Scénarisation, énigmes de terrain, audit de sécurité et ouverture MCP
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs Bar */}
                <div style={{
                    display: 'flex',
                    borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                    padding: '0 16px',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    gap: '4px'
                }}>
                    {[
                        { id: 'narrative', label: 'Scénarisation & Thème', icon: BookOpen },
                        { id: 'riddles', label: 'Énigmes & Balises', icon: Key },
                        { id: 'safety', label: 'Audit Sécurité', icon: ShieldAlert },
                        { id: 'mcp', label: 'Connecteurs & MCP', icon: Network },
                        { id: 'config', label: 'Fournisseurs IA', icon: Settings },
                    ].map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '10px 14px',
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: isActive ? '2px solid #10b981' : '2px solid transparent',
                                    color: isActive ? '#fff' : '#888',
                                    fontSize: '12px',
                                    fontWeight: isActive ? 600 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <Icon size={14} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {/* 1. NARRATIVE TAB */}
                    {activeTab === 'narrative' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>
                                        Thème imaginaire du Raid
                                    </label>
                                    <input 
                                        type="text"
                                        value={themeInput}
                                        onChange={e => setThemeInput(e.target.value)}
                                        placeholder="Ex: Les Chevaliers de la Table Ronde, Le Maquis de 1944..."
                                        style={{
                                            width: '100%',
                                            marginTop: '6px',
                                            padding: '8px 12px',
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            color: '#fff',
                                            fontSize: '13px'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>
                                        Tonalité
                                    </label>
                                    <select
                                        value={targetTone}
                                        onChange={e => setTargetTone(e.target.value as any)}
                                        style={{
                                            width: '100%',
                                            marginTop: '6px',
                                            padding: '8px 12px',
                                            backgroundColor: '#222',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            color: '#fff',
                                            fontSize: '13px'
                                        }}
                                    >
                                        <option value="epic">Épique & Héroïque</option>
                                        <option value="mysterious">Mystérieux & Enquête</option>
                                        <option value="scout_classic">Scout Traditionnel</option>
                                        <option value="humorous">Léger & Humoristique</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>
                                        Branche Scoute
                                    </label>
                                    <select
                                        value={scoutBranch}
                                        onChange={e => setScoutBranch(e.target.value as any)}
                                        style={{
                                            width: '100%',
                                            marginTop: '6px',
                                            padding: '8px 12px',
                                            backgroundColor: '#222',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            color: '#fff',
                                            fontSize: '13px'
                                        }}
                                    >
                                        <option value="louveteaux">Louveteaux (8-12 ans)</option>
                                        <option value="eclaireurs">Éclaireurs (12-17 ans)</option>
                                        <option value="ainés">Pionniers / Routiers (17+)</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleGenerateNarrative}
                                disabled={narrativeLoading}
                                style={{
                                    alignSelf: 'flex-start',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '9px 16px',
                                    backgroundColor: '#10b981',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    fontSize: '13px',
                                    cursor: narrativeLoading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {narrativeLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                                {narrativeLoading ? 'Création de la trame...' : 'Générer la trame narrative'}
                            </button>

                            {narrativeResult && (
                                <div style={{
                                    marginTop: '12px',
                                    padding: '16px',
                                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px'
                                }}>
                                    <h4 style={{ margin: 0, color: '#34d399', fontSize: '16px' }}>{narrativeResult.theme_title}</h4>
                                    <div>
                                        <strong style={{ color: '#fff', fontSize: '13px' }}>Introduction de départ :</strong>
                                        <p style={{ margin: '4px 0', fontSize: '13px', color: '#ccc', fontStyle: 'italic' }}>
                                            "{narrativeResult.intro_story}"
                                        </p>
                                    </div>

                                    <div>
                                        <strong style={{ color: '#fff', fontSize: '13px' }}>Progression par étapes :</strong>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                                            {narrativeResult.stage_stories.map((st, i) => (
                                                <div key={i} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '12px' }}>
                                                    <span style={{ fontWeight: 600, color: '#fff' }}>{st.title} : </span>
                                                    <span style={{ color: '#bbb' }}>{st.story_snippet}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <strong style={{ color: '#fff', fontSize: '13px' }}>Dénouement final :</strong>
                                        <p style={{ margin: '4px 0', fontSize: '13px', color: '#ccc' }}>
                                            "{narrativeResult.outro_story}"
                                        </p>
                                    </div>

                                    {narrativeResult.suggested_music_or_atmosphere && (
                                        <div style={{ fontSize: '11px', color: '#888' }}>
                                            🎵 Ambiance / Chant suggéré : <strong>{narrativeResult.suggested_music_or_atmosphere}</strong>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 2. RIDDLES TAB */}
                    {activeTab === 'riddles' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>
                                        Lieu ou Point d'Intérêt (POI)
                                    </label>
                                    <input 
                                        type="text"
                                        value={selectedPoi}
                                        onChange={e => setSelectedPoi(e.target.value)}
                                        placeholder="Ex: Fontaine Saint-Martin, Dolmen de la Pierre Levée..."
                                        style={{
                                            width: '100%',
                                            marginTop: '6px',
                                            padding: '8px 12px',
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            color: '#fff',
                                            fontSize: '13px'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>
                                        Code de chiffrement
                                    </label>
                                    <select
                                        value={riddleModule}
                                        onChange={e => setRiddleModule(e.target.value)}
                                        style={{
                                            width: '100%',
                                            marginTop: '6px',
                                            padding: '8px 12px',
                                            backgroundColor: '#222',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            color: '#fff',
                                            fontSize: '13px'
                                        }}
                                    >
                                        <option value="morse">Code Morse</option>
                                        <option value="avocat">Chiffre Avocat (A=K)</option>
                                        <option value="cassis">Chiffre Cassis (K=6)</option>
                                        <option value="templier">Code des Templiers</option>
                                        <option value="polybe">Carré de Polybe</option>
                                        <option value="vigenere">Chiffre de Vigenère</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>
                                        Difficulté
                                    </label>
                                    <select
                                        value={riddleDifficulty}
                                        onChange={e => setRiddleDifficulty(e.target.value as any)}
                                        style={{
                                            width: '100%',
                                            marginTop: '6px',
                                            padding: '8px 12px',
                                            backgroundColor: '#222',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            color: '#fff',
                                            fontSize: '13px'
                                        }}
                                    >
                                        <option value="easy">Facile (Initié)</option>
                                        <option value="medium">Moyen (Éclaireur)</option>
                                        <option value="hard">Difficile (Expert)</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleGenerateRiddle}
                                disabled={riddleLoading}
                                style={{
                                    alignSelf: 'flex-start',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '9px 16px',
                                    backgroundColor: '#10b981',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    fontSize: '13px',
                                    cursor: riddleLoading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {riddleLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                                {riddleLoading ? 'Génération de l\'énigme...' : 'Créer une énigme codée'}
                            </button>

                            {riddleResult && (
                                <div style={{
                                    padding: '16px',
                                    backgroundColor: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                }}>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                                        Énigme à imprimer dans le carnet :
                                    </div>
                                    <div style={{ fontStyle: 'italic', fontSize: '13px', color: '#e5e7eb', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '6px' }}>
                                        "{riddleResult.riddle_text}"
                                    </div>
                                    <div style={{ display: 'flex', gap: '20px', fontSize: '12px' }}>
                                        <div>
                                            <span style={{ color: '#888' }}>Mot-clé solution : </span>
                                            <strong style={{ color: '#34d399', letterSpacing: '1px' }}>{riddleResult.solution_word}</strong>
                                        </div>
                                    </div>
                                    {riddleResult.pedagogical_tip && (
                                        <div style={{ fontSize: '12px', color: '#aaa', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                                            💡 Conseil animateur : {riddleResult.pedagogical_tip}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 3. SAFETY AUDIT TAB */}
                    {activeTab === 'safety' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px' }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                                        Synthèse du tracé actif : {stagesPayload.length} étapes ({totalKm.toFixed(1)} km)
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#888' }}>
                                        Vérification automatique des seuils de fatigue, risques de soif et règles scoutes.
                                    </div>
                                </div>
                                <button
                                    onClick={handleRunSafetyAudit}
                                    disabled={auditLoading}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 14px',
                                        backgroundColor: '#10b981',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        cursor: auditLoading ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {auditLoading ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                                    {auditLoading ? 'Audit en cours...' : 'Lancer l\'audit de sécurité'}
                                </button>
                            </div>

                            {auditResult && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        backgroundColor: auditResult.global_rating === 'safe' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                        border: `1px solid ${auditResult.global_rating === 'safe' ? '#10b981' : '#f59e0b'}`
                                    }}>
                                        <div style={{ fontWeight: 700, color: auditResult.global_rating === 'safe' ? '#34d399' : '#fbbf24', fontSize: '14px' }}>
                                            Niveau global : {auditResult.global_rating.toUpperCase()}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#e5e7eb', marginTop: '4px' }}>
                                            {auditResult.summary}
                                        </div>
                                    </div>

                                    {auditResult.alerts.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#aaa' }}>Alertes & Recommandations :</div>
                                            {auditResult.alerts.map((al, idx) => (
                                                <div key={idx} style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontSize: '13px', fontWeight: 600 }}>
                                                        <AlertTriangle size={14} />
                                                        {al.title}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#ccc', margin: '3px 0' }}>{al.description}</div>
                                                    <div style={{ fontSize: '11px', color: '#34d399' }}>✓ Conseil : {al.recommendation}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ fontSize: '12px', color: '#888', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '6px' }}>
                                        💧 <strong>Points d'eau :</strong> {auditResult.water_points_advice}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 4. MCP & CONNECTORS TAB */}
                    {activeTab === 'mcp' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{
                                padding: '14px',
                                borderRadius: '8px',
                                background: 'rgba(16, 185, 129, 0.08)',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Compass size={16} color="#34d399" />
                                        Serveur MCP ScoutRaider Actif
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#aaa', marginTop: '3px' }}>
                                        Permet à Antigravity, Claude Desktop ou Cursor de piloter vos raids et épreuves.
                                    </div>
                                </div>
                                <button
                                    onClick={copyMcpConfigToClipboard}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '7px 12px',
                                        backgroundColor: '#10b981',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: '#fff',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {copiedMcpConfig ? <Check size={14} /> : <Copy size={14} />}
                                    {copiedMcpConfig ? 'Copié !' : 'Copier JSON MCP'}
                                </button>
                            </div>

                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#aaa', marginBottom: '8px' }}>
                                    CONNECTEURS EXTERNES ENREGISTRÉS :
                                </div>
                                {connectorsLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '12px' }}>
                                        <Loader2 size={14} className="animate-spin" /> Chargement des connecteurs...
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {connectors.map(c => (
                                            <div key={c.id} style={{
                                                padding: '12px 14px',
                                                borderRadius: '8px',
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>{c.name}</div>
                                                    <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{c.description}</div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                                                        Actif
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 5. CONFIG TAB */}
                    {activeTab === 'config' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>
                                    Fournisseur d'Intelligence Artificielle
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' }}>
                                    {[
                                        { id: 'gemini', label: 'Google Gemini', sub: 'Cloud Rapide' },
                                        { id: 'claude', label: 'Anthropic Claude', sub: 'Haute Précision' },
                                        { id: 'openai', label: 'OpenAI (GPT-4o)', sub: 'Cloud Standard' },
                                        { id: 'ollama', label: 'Ollama (Local)', sub: '100% Hors-Ligne Gratuit' },
                                    ].map(prov => (
                                        <div
                                            key={prov.id}
                                            onClick={() => setConfig(prev => ({ ...prev, provider: prov.id as any }))}
                                            style={{
                                                padding: '12px',
                                                borderRadius: '8px',
                                                backgroundColor: config.provider === prov.id ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${config.provider === prov.id ? '#10b981' : 'rgba(255,255,255,0.08)'}`,
                                                cursor: 'pointer',
                                                textAlign: 'center'
                                            }}
                                        >
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: config.provider === prov.id ? '#34d399' : '#fff' }}>
                                                {prov.label}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{prov.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {config.provider !== 'ollama' ? (
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>
                                        Clé d'API ({config.provider.toUpperCase()})
                                    </label>
                                    <input 
                                        type="password"
                                        value={config.apiKey || ''}
                                        onChange={e => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                                        placeholder={`Entrez votre clé API ${config.provider}...`}
                                        style={{
                                            width: '100%',
                                            marginTop: '6px',
                                            padding: '8px 12px',
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            color: '#fff',
                                            fontSize: '13px'
                                        }}
                                    />
                                    <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                                        La clé est conservée localement dans votre navigateur et n'est jamais transmise à des tiers.
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>
                                        Adresse de l'hôte Ollama Local
                                    </label>
                                    <input 
                                        type="text"
                                        value={config.endpointUrl || 'http://localhost:11434'}
                                        onChange={e => setConfig(prev => ({ ...prev, endpointUrl: e.target.value }))}
                                        placeholder="http://localhost:11434"
                                        style={{
                                            width: '100%',
                                            marginTop: '6px',
                                            padding: '8px 12px',
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            color: '#fff',
                                            fontSize: '13px'
                                        }}
                                    />
                                    <div style={{ fontSize: '11px', color: '#34d399', marginTop: '4px' }}>
                                        ✓ Recommandé en camp ou en forêt : fonctionne sans aucune connexion internet !
                                    </div>
                                </div>
                            )}

                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>
                                    Modèle Spécifique (Optionnel)
                                </label>
                                <input 
                                    type="text"
                                    value={config.modelName || ''}
                                    onChange={e => setConfig(prev => ({ ...prev, modelName: e.target.value }))}
                                    placeholder={config.provider === 'gemini' ? 'gemini-1.5-flash' : config.provider === 'claude' ? 'claude-3-5-sonnet-20241022' : config.provider === 'ollama' ? 'llama3' : 'gpt-4o-mini'}
                                    style={{
                                        width: '100%',
                                        marginTop: '6px',
                                        padding: '8px 12px',
                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '6px',
                                        color: '#fff',
                                        fontSize: '13px'
                                    }}
                                />
                            </div>

                            <button
                                onClick={handleSaveConfig}
                                style={{
                                    alignSelf: 'flex-start',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '9px 18px',
                                    backgroundColor: '#10b981',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                {configSaved ? <Check size={16} /> : <Settings size={16} />}
                                {configSaved ? 'Enregistré !' : 'Sauvegarder les réglages'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

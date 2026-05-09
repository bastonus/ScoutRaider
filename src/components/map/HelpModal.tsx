import React from 'react';
import { X, BookOpen, Map, Navigation, GitBranch, FileText, Download } from 'lucide-react';

interface HelpModalProps {
    open: boolean;
    onClose: () => void;
}

export default function HelpModal({ open, onClose }: HelpModalProps) {
    if (!open) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{
                width: '640px', maxHeight: '80vh',
                background: 'var(--bg-panel)', border: '1px solid var(--bg-border)',
                borderRadius: '14px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                animation: 'slideInY 0.2s ease-out',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', borderBottom: '1px solid var(--bg-border)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BookOpen size={18} color="var(--accent-default)" />
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                            Guide — ScoutRaider Suite
                        </span>
                    </div>
                    <button type="button" onClick={onClose} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-dim)', display: 'flex', padding: '4px',
                        borderRadius: '6px',
                    }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                    {/* Warning */}
                    <div style={{
                        background: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '10px', padding: '14px 16px', marginBottom: '20px',
                    }}>
                        <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '12px', marginBottom: '8px' }}>
                            ⚠️ AVERTISSEMENT DE SÉCURITÉ — LIRE IMPÉRATIVEMENT
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(245, 158, 11, 0.85)', lineHeight: 1.6 }}>
                            Les azimuts, métrages et instructions générés sont calculés <strong>algorithmiquement</strong> et peuvent contenir des <strong>erreurs</strong>.<br /><br />
                            <strong>Avant d'envoyer des scouts sur le terrain :</strong>
                            <ul style={{ margin: '8px 0 0 16px', padding: 0, lineHeight: 2 }}>
                                <li>✅ Vérifier manuellement chaque azimut sur une carte IGN papier</li>
                                <li>✅ Reconnaître l'itinéraire sur le terrain avant le jour J</li>
                                <li>✅ Corriger les azimuts avec l'outil Azimut si nécessaire</li>
                                <li>✅ Tester le carnet avec un chef avant de le distribuer</li>
                                <li>✅ Prévoir un plan B (points de ralliement, téléphone d'urgence)</li>
                            </ul>
                        </div>
                    </div>

                    {/* Steps */}
                    {[
                        {
                            icon: <Map size={15} />, title: 'Étape 1 — Tracer l\'itinéraire',
                            steps: [
                                'Sélectionne l\'outil Route dans la barre d\'outils.',
                                'Clique sur la carte pour poser ton point de départ (A).',
                                'Clique à nouveau pour ajouter des étapes (B, C, D…).',
                                'Le moteur calcule automatiquement la route pédestre via BRouter.',
                                'Astuce : utilise la vue satellite (barre du haut) pour vérifier le terrain.',
                            ]
                        },
                        {
                            icon: <GitBranch size={15} />, title: 'Étape 2 — Segmenter le tracé',
                            steps: [
                                'Va dans l\'onglet Segmentation (panneau gauche).',
                                'Ajuste la sensibilité virage et la longueur minimale.',
                                'Clique sur « Recalculer les segments ».',
                                'Le tracé est découpé en tronçons avec azimut et métrage.',
                            ]
                        },
                        {
                            icon: <Navigation size={15} />, title: 'Étape 3 — Affiner les azimuts',
                            steps: [
                                'Outil Nœuds (N) : clique sur le tracé pour ajouter un nœud.',
                                'Outil Azimut (A) : glisse la poignée pour corriger un azimut.',
                                '⚠️ Vérifie chaque azimut — les calculs auto peuvent diverger.',
                            ]
                        },
                        {
                            icon: <FileText size={15} />, title: 'Étape 4 — Encoder les épreuves',
                            steps: [
                                'Sélectionne l\'outil Encodage (E).',
                                'Clique sur un tronçon et choisis le module à assigner.',
                                'Ou glisse-dépose un module depuis la palette.',
                                'L\'orchestrateur automatique peut répartir les épreuves.',
                            ]
                        },
                        {
                            icon: <Download size={15} />, title: 'Étape 5 — Exporter le carnet PDF',
                            steps: [
                                'Clique sur Fichier → Exporter en PDF (ou Ctrl+E).',
                                'Deux fichiers sont générés : Carnet Participant et Carnet Solution.',
                                '⚠️ Relis et teste le carnet avant de l\'imprimer !',
                            ]
                        },
                    ].map((section, i) => (
                        <div key={i} style={{ marginBottom: '20px' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                marginBottom: '10px', paddingBottom: '8px',
                                borderBottom: '1px solid var(--bg-border)',
                            }}>
                                <span style={{ color: 'var(--accent-default)' }}>{section.icon}</span>
                                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                                    {section.title}
                                </span>
                            </div>
                            <ol style={{ margin: 0, paddingLeft: '20px' }}>
                                {section.steps.map((step, j) => (
                                    <li key={j} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '2px' }}>
                                        {step}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    ))}

                    {/* Tips */}
                    <div style={{
                        background: 'rgba(110, 201, 126, 0.05)',
                        border: '1px solid rgba(110, 201, 126, 0.12)',
                        borderRadius: '10px', padding: '14px 16px',
                    }}>
                        <div style={{ fontWeight: 700, color: 'var(--accent-default)', fontSize: '12px', marginBottom: '8px' }}>
                            💡 Conseils pour un bon Raid
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 2 }}>
                            <li>🗺️ Kilométrage : 10-15 km (Promesse), 15-20 km/j (2nde Classe), 20-25 km/j (1ère Classe)</li>
                            <li>🧭 Varier les épreuves : alterner azimut-distance, Morse, Vigenère, carte IGN…</li>
                            <li>⛺ Sécurité : points téléphone, plan de repli, trousse de secours, eau 2L/jour min.</li>
                            <li>📐 Croquis : prévoir les emplacements de croquis panoramiques et topographiques</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 20px', borderTop: '1px solid var(--bg-border)',
                    display: 'flex', justifyContent: 'flex-end',
                }}>
                    <button type="button" onClick={onClose} style={{
                        background: 'var(--accent-default)', border: 'none', borderRadius: '8px',
                        color: '#0a0f0c', fontWeight: 700, fontSize: '12px',
                        padding: '8px 20px', cursor: 'pointer',
                    }}>
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
}

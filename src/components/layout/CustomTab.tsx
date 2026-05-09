import React from 'react';
import { MapPin, Library, Share2, Layers, FolderOpen, Navigation, Code, Palette, X } from 'lucide-react';

const TabIcons: Record<string, any> = {
    'panel_map': MapPin,
    'panel_itinerary': Navigation,
    'panel_presets': Layers,
    'panel_modules': Code,
    'panel_themes': Palette,
    'panel_export': Share2
};

export default function TabRenderer(props: any) {
    const isActive = props.api.isActive;
    const isUnsaved = props.api.id === 'panel_map';
    const Icon = TabIcons[props.api.id] || FolderOpen;

    return (
        <div className={`chrome-tab ${isActive ? 'active' : ''}`} 
             onClick={() => props.api.setActive()}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '12px', marginRight: '12px' }}>
                <Icon size={14} strokeWidth={2.5} color={isActive ? 'var(--text-primary)' : 'var(--text-dim)'} />
                <span style={{ 
                    fontSize: '12px', 
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#fff' : 'var(--text-dim)',
                    whiteSpace: 'nowrap',
                    textTransform: 'none',
                    letterSpacing: '0.01em',
                    marginTop: '1px' // Alignement fin avec l'icone
                }}>
                    {props.api.title}
                </span>

                {isUnsaved && (
                    <div style={{ 
                        width: '6px', height: '6px', borderRadius: '50%', 
                        background: 'var(--accent-default)', marginLeft: '6px',
                        boxShadow: '0 0 8px var(--accent-glow)',
                        animation: 'pulse 2s infinite'
                    }} title="Non sauvegardé" />
                )}
            </div>

            {/* BOUTON FERMER (si nécessaire) */}
            {isActive && props.api.id !== 'panel_map' && props.api.id !== 'panel_itinerary' && (
                <div 
                  className="tab-x"
                  onClick={(e) => { e.stopPropagation(); props.api.close(); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '20px', height: '20px', borderRadius: '4px',
                    opacity: 0.5, transition: '0.2s'
                  }}
                >
                    <X size={12} strokeWidth={3} />
                </div>
            )}
        </div>
    );
}

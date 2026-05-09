import React, { useState, useRef, useEffect } from 'react';
import MapWorkspace from '../map/MapWorkspace';
import TextualView from '../textual/TextualView';
import type { ViewMode } from '../../App';

interface ProjectWorkspaceProps {
    onExport?: () => void;
    viewMode?: ViewMode;
}

export default function ProjectWorkspace({ onExport, viewMode = 'map' }: ProjectWorkspaceProps) {
    const [mapWidthRatio, setMapWidthRatio] = useState(50);
    const resizing = useRef(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizing.current) {
                const container = document.getElementById('project-workspace-container');
                if (container) {
                    const rect = container.getBoundingClientRect();
                    let ratio = ((e.clientX - rect.left) / rect.width) * 100;
                    ratio = Math.max(20, Math.min(80, ratio));
                    setMapWidthRatio(ratio);
                }
            }
        };
        const handleMouseUp = () => {
            if (resizing.current) {
                resizing.current = false;
                document.body.style.cursor = 'default';
                window.dispatchEvent(new Event('resize'));
            }
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
            <div id="project-workspace-container" style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
                {(viewMode === 'map' || viewMode === 'split') && (
                    <div style={{ width: viewMode === 'split' ? `${mapWidthRatio}%` : '100%', height: '100%', position: 'relative', flexShrink: 0 }}>
                        <MapWorkspace isSplitMode={viewMode === 'split'} />
                    </div>
                )}
                
                {viewMode === 'split' && (
                    <div 
                        onMouseDown={(e) => { e.preventDefault(); resizing.current = true; document.body.style.cursor = 'col-resize'; }}
                        style={{ width: '4px', cursor: 'col-resize', background: 'var(--bg-border)', zIndex: 50, margin: '0 -2px' }} 
                    />
                )}

                {(viewMode === 'text' || viewMode === 'split') && (
                    <div style={{ 
                        flex: viewMode === 'split' ? 1 : undefined,
                        width: viewMode === 'text' ? '100%' : undefined,
                        height: '100%', 
                        background: 'var(--bg-dark)',
                        borderLeft: viewMode === 'split' ? '1px solid rgba(110, 201, 126, 0.05)' : 'none'
                    }}>
                        <TextualView onExport={onExport} viewMode={viewMode} />
                    </div>
                )}
            </div>
        </div>
    );
}

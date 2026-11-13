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
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    const resizing = useRef(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizing.current) {
                const container = document.getElementById('project-workspace-container');
                if (container) {
                    const rect = container.getBoundingClientRect();
                    let ratio: number;
                    if (isMobile) {
                        ratio = ((e.clientY - rect.top) / rect.height) * 100;
                    } else {
                        ratio = ((e.clientX - rect.left) / rect.width) * 100;
                    }
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
    }, [isMobile]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
            <div 
                id="project-workspace-container" 
                style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: (isMobile && viewMode === 'split') ? 'column' : 'row',
                    minHeight: 0, 
                    position: 'relative' 
                }}
            >
                {(viewMode === 'map' || viewMode === 'split') && (
                    <div style={{ 
                        width: (isMobile && viewMode === 'split') ? '100%' : (viewMode === 'split' ? `${mapWidthRatio}%` : '100%'), 
                        height: (isMobile && viewMode === 'split') ? `${mapWidthRatio}%` : '100%', 
                        position: 'relative', 
                        flexShrink: 0 
                    }}>
                        <MapWorkspace isSplitMode={viewMode === 'split'} />
                    </div>
                )}
                
                {viewMode === 'split' && (
                    <div 
                        onMouseDown={(e) => { 
                            e.preventDefault(); 
                            resizing.current = true; 
                            document.body.style.cursor = isMobile ? 'row-resize' : 'col-resize'; 
                        }}
                        style={{ 
                            width: isMobile ? '100%' : '4px', 
                            height: isMobile ? '4px' : '100%',
                            cursor: isMobile ? 'row-resize' : 'col-resize', 
                            background: 'var(--bg-border)', 
                            zIndex: 50, 
                            margin: isMobile ? '-2px 0' : '0 -2px' 
                        }} 
                    />
                )}

                {(viewMode === 'text' || viewMode === 'split') && (
                    <div style={{ 
                        flex: viewMode === 'split' ? 1 : undefined,
                        width: viewMode === 'text' ? '100%' : undefined,
                        height: '100%', 
                        background: 'var(--bg-dark)',
                        borderLeft: (!isMobile && viewMode === 'split') ? '1px solid var(--border-subtle)' : 'none',
                        borderTop: (isMobile && viewMode === 'split') ? '1px solid var(--border-subtle)' : 'none',
                        minHeight: 0,
                        overflow: 'hidden'
                    }}>
                        <TextualView onExport={onExport} viewMode={viewMode} />
                    </div>
                )}
            </div>
        </div>
    );
}

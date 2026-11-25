import React, { useState, useRef, useEffect } from 'react';
import MapWorkspace from '../map/MapWorkspace';
import TextualView from '../textual/TextualView';
import ErrorBoundary from '../common/ErrorBoundary';
import { useViewport } from '../../hooks';
import type { ViewMode } from '../../App';

interface ProjectWorkspaceProps {
    onExport?: () => void;
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    onToggleSidebar?: (side: 'left' | 'right') => void;
    rightSidebarOpen?: boolean;
}

export default function ProjectWorkspace({ onExport, viewMode = 'map', onViewModeChange, onToggleSidebar, rightSidebarOpen }: ProjectWorkspaceProps) {
    const [mapWidthRatio, setMapWidthRatio] = useState(50);
    const { isMobile } = useViewport();
    const resizing = useRef(false);

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
                        <ErrorBoundary fallbackTitle="Erreur dans l'espace cartographique">
                            <MapWorkspace 
                                isSplitMode={viewMode === 'split'} 
                                onViewModeChange={onViewModeChange}
                                onToggleSidebar={onToggleSidebar} 
                            />
                        </ErrorBoundary>
                    </div>
                )}
                
                {viewMode === 'split' && (
                    <div
                        role="separator"
                        aria-orientation={isMobile ? 'horizontal' : 'vertical'}
                        aria-label="Redimensionner la vue scindée"
                        aria-valuenow={Math.round(mapWidthRatio)}
                        aria-valuemin={20}
                        aria-valuemax={80}
                        tabIndex={0}
                        onMouseDown={(e) => { 
                            e.preventDefault(); 
                            resizing.current = true; 
                            document.body.style.cursor = isMobile ? 'row-resize' : 'col-resize'; 
                        }}
                        onKeyDown={(e) => {
                            const dec = isMobile ? 'ArrowUp' : 'ArrowLeft';
                            const inc = isMobile ? 'ArrowDown' : 'ArrowRight';
                            if (e.key === dec) {
                                e.preventDefault();
                                setMapWidthRatio(r => Math.max(20, r - 5));
                                window.dispatchEvent(new Event('resize'));
                            } else if (e.key === inc) {
                                e.preventDefault();
                                setMapWidthRatio(r => Math.min(80, r + 5));
                                window.dispatchEvent(new Event('resize'));
                            }
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
                        minWidth: 0,
                        minHeight: 0,
                        overflow: 'hidden'
                    }}>
                        <ErrorBoundary fallbackTitle="Erreur dans l'éditeur de carnet">
                            <TextualView 
                                onExport={onExport} 
                                viewMode={viewMode} 
                                onViewModeChange={onViewModeChange}
                                onToggleSidebar={onToggleSidebar} 
                                rightSidebarOpen={rightSidebarOpen} 
                            />
                        </ErrorBoundary>
                    </div>
                )}
            </div>
        </div>
    );
}

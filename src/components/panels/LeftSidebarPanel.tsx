import React from 'react';
import RoutePanel from './RoutePanel';

/**
 * LeftSidebarPanel — Uniquement les étapes de l'itinéraire actif.
 * Les calques sont dans la RightSidebar (onglet Calques).
 */
export default function LeftSidebarPanel() {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            overflow: 'hidden', background: 'var(--bg-panel)'
        }}>
            <RoutePanel />
        </div>
    );
}

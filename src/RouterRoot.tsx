/**
 * RouterRoot.tsx — Gestionnaire de routes SPA ScoutRaider.
 * Utilise HashRouter pour compatibilité Electron (file://) + Web.
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import ProjectsHomePage from './pages/ProjectsHomePage';
import EditorPage from './pages/EditorPage';
import MarketplacePage from './pages/MarketplacePage';

export default function RouterRoot() {
    const { isAuthenticated, isLoading } = useAuth();

    // Show nothing while auth state is resolving
    if (isLoading) {
        return (
            <div
                role="status"
                aria-label="Chargement de la session"
                style={{
                    minHeight: '100dvh',
                    background: 'var(--bg-base)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <div style={{
                    width: '36px',
                    height: '36px',
                    border: '3px solid rgba(37, 99, 235, 0.2)',
                    borderTopColor: 'var(--accent-primary)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <Routes>
            {/* Root: redirect based on auth state */}
            <Route
                path="/"
                element={
                    isAuthenticated
                        ? <Navigate to="/projects" replace />
                        : <Navigate to="/login" replace />
                }
            />

            {/* Login / Register page */}
            <Route path="/login" element={<LoginPage />} />

            {/* Projects home — accessible to both authenticated and guests */}
            <Route path="/projects" element={<ProjectsHomePage />} />
            <Route path="/projets" element={<ProjectsHomePage />} />

            {/* Marketplace — standalone community modules page */}
            <Route path="/marketplace" element={<MarketplacePage />} />

            {/* Document editor — unique URL per document */}
            <Route path="/d/:identifier" element={<EditorPage />} />

            {/* Fallback: redirect unknown routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

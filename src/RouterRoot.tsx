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

export default function RouterRoot() {
    const { isAuthenticated, isGuest, isLoading } = useAuth();

    // Show nothing while auth state is resolving
    if (isLoading) {
        return (
            <div style={{
                minHeight: '100vh',
                background: '#0d1511',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div style={{
                    width: '36px',
                    height: '36px',
                    border: '3px solid rgba(110,201,126,0.2)',
                    borderTopColor: '#6EC97E',
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

            {/* Document editor — unique URL per document */}
            <Route path="/d/:identifier" element={<EditorPage />} />

            {/* Fallback: redirect unknown routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

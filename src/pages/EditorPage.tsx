/**
 * EditorPage.tsx — Wrapper de l'éditeur ScoutRaider pour une URL de document unique.
 * Route: /d/:identifier  (identifier = 'new' | share_token | project_id)
 *
 * - /d/new          → éditeur vierge, URL mise à jour vers /d/<id> après le premier save
 * - /d/<share_token> → ouvre un doc partagé/public (token commence par doc_)
 * - /d/<project_id>  → ouvre un projet cloud de l'utilisateur
 */

import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import App from '../App';

export default function EditorPage() {
    const { identifier } = useParams<{ identifier: string }>();
    const navigate = useNavigate();
    const {
        isLoading,
        isAuthenticated,
        isGuest,
        cloudProjectId,
        shareToken,
        loadSharedDoc,
        loadFromCloud,
        newProject,
    } = useAuth();

    // Track which identifier has already been loaded to avoid double-loads
    const loadedIdentifier = useRef<string | null>(null);

    // ── Instant /d/new: call newProject() synchronously, skip isLoading gate ──
    useEffect(() => {
        if (identifier === 'new' && loadedIdentifier.current !== 'new') {
            loadedIdentifier.current = 'new';
            newProject();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [identifier]);

    // ── Load document when identifier changes ────────────────────────────────
    useEffect(() => {
        if (isLoading) return;
        if (!identifier) return;
        if (identifier === 'new') return; // already handled above
        if (loadedIdentifier.current === identifier) return;

        loadedIdentifier.current = identifier;

        const isToken = identifier.startsWith('doc_');

        if (isToken) {
            loadSharedDoc(identifier);
        } else if (isAuthenticated || !isGuest) {
            loadFromCloud(identifier);
        } else {
            loadSharedDoc(identifier);
        }
    }, [isLoading, identifier, isAuthenticated, isGuest, loadSharedDoc, loadFromCloud, newProject]);

    // ── After first save on /d/new: redirect to /d/<projectId> ───────────────
    useEffect(() => {
        if (!cloudProjectId) return;
        if (identifier === 'new') {
            // Replace /d/new with the real project URL (use share_token if available)
            const targetId = shareToken || cloudProjectId;
            navigate(`/d/${targetId}`, { replace: true });
        }
    }, [cloudProjectId, shareToken, identifier, navigate]);

    return <App />;
}

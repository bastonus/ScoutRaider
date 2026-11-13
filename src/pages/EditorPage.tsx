/**
 * EditorPage.tsx — Wrapper de l'éditeur ScoutRaider pour une URL de document unique.
 * Route: /d/:identifier  (identifier = share_token ou project_id)
 */

import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import App from '../App';

export default function EditorPage() {
    const { identifier } = useParams<{ identifier: string }>();
    const navigate = useNavigate();
    const { isLoading, isAuthenticated, isGuest, loadSharedDoc, loadFromCloud } = useAuth();
    const loaded = useRef(false);

    useEffect(() => {
        if (isLoading || !identifier || loaded.current) return;
        loaded.current = true;

        const isToken = identifier.startsWith('doc_');

        if (isToken) {
            // Shared/public permalink — works unauthenticated
            loadSharedDoc(identifier);
        } else if (isAuthenticated || !isGuest) {
            // Project ID — requires authentication
            loadFromCloud(identifier);
        } else {
            // Guest trying to open a project by ID — treat as shared
            loadSharedDoc(identifier);
        }
    }, [isLoading, identifier, isAuthenticated, isGuest, loadSharedDoc, loadFromCloud]);

    return <App />;
}

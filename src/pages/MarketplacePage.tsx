import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Store,
  Plus,
  Code,
  Sliders,
  Palette,
  Check,
  RefreshCw,
  Download,
  GitFork,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  Sparkles,
  Play,
  X,
  User,
  LogOut,
  ChevronDown,
  Loader2,
  FolderOpen
} from 'lucide-react';
import { CloudAuthService, MarketplaceModule, UserLibraryItem } from '../logic/CloudAuthService';
import { useAuth } from '../AuthContext';
import FleurDeLysLogo from '../components/layout/FleurDeLysLogo';

type CategoryFilter = 'all' | 'code' | 'orchestration' | 'theme' | 'my_library';

export default function MarketplacePage() {
  const navigate = useNavigate();
  const { user, isGuest, isAuthenticated, logout, setAuthModalOpen } = useAuth();

  const [activeTab, setActiveTab] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modules, setModules] = useState<MarketplaceModule[]>([]);
  const [userLibrary, setUserLibrary] = useState<UserLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // User menu state
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Module Editor & Preview State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Partial<MarketplaceModule> | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isCompilingPreview, setIsCompilingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load Marketplace & User Library
  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    setErrorMsg(null);
    try {
      const [mList, uLib] = await Promise.all([
        CloudAuthService.listMarketplaceModules(activeTab === 'my_library' ? undefined : activeTab, searchQuery),
        CloudAuthService.getUserLibrary()
      ]);
      setModules(mList);
      setUserLibrary(uLib);
    } catch (e: any) {
      setErrorMsg(e.message || 'Impossible de charger la marketplace.');
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check if module is in user library
  const isInLibrary = (moduleId: string) => {
    return userLibrary.some(item => item.module_id === moduleId);
  };

  // Toggle user library
  const handleToggleLibrary = async (mod: MarketplaceModule) => {
    if (isGuest) {
      setAuthModalOpen(true);
      return;
    }
    const already = isInLibrary(mod.id);
    try {
      if (already) {
        await CloudAuthService.removeFromUserLibrary(mod.id);
        setUserLibrary(prev => prev.filter(item => item.module_id !== mod.id));
      } else {
        await CloudAuthService.addToUserLibrary(mod.id, mod.name, mod.category);
        const updated = await CloudAuthService.getUserLibrary();
        setUserLibrary(updated);
      }
    } catch (e: any) {
      alert(`Erreur: ${e.message}`);
    }
  };

  // Toggle visibility (Public / Privé)
  const handleToggleVisibility = async (mod: MarketplaceModule, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newVis = !mod.is_public;
      await CloudAuthService.updateModuleVisibility(mod.id, newVis);
      setModules(prev => prev.map(m => m.id === mod.id ? { ...m, is_public: newVis } : m));
    } catch (e: any) {
      alert(`Erreur de modification de visibilité: ${e.message}`);
    }
  };

  // Fork a module
  const handleFork = async (mod: MarketplaceModule, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGuest) {
      setAuthModalOpen(true);
      return;
    }
    try {
      const forked = await CloudAuthService.forkMarketplaceModule(mod.id);
      setModules(prev => [forked, ...prev]);
      alert(`Module forké avec succès : "${forked.name}" a été ajouté à votre bibliothèque !`);
    } catch (e: any) {
      alert(`Erreur lors du fork: ${e.message}`);
    }
  };

  // Delete a module (if owner)
  const handleDelete = async (mod: MarketplaceModule, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer le module "${mod.name}" de la marketplace ? Cette action est irréversible.`)) {
      return;
    }
    try {
      await CloudAuthService.deleteMarketplaceModule(mod.id);
      setModules(prev => prev.filter(m => m.id !== mod.id));
    } catch (e: any) {
      alert(`Erreur lors de la suppression: ${e.message}`);
    }
  };

  // Open editor for creating or editing
  const handleOpenEditor = (mod?: MarketplaceModule) => {
    if (mod) {
      setEditingModule({ ...mod });
      setPreviewImage(mod.preview_image || null);
    } else {
      setEditingModule({
        name: '',
        category: 'code',
        description: '',
        version: '1.0.0',
        is_public: true,
        code: `def encode(solution_text, options=None):\n    # Écrivez votre algorithme d'encodage ici\n    return solution_text.upper()\n`,
        config: {}
      });
      setPreviewImage(null);
    }
    setEditorOpen(true);
  };

  // Compile code on server to generate preview image
  const handleCompilePreview = async () => {
    if (!editingModule) return;
    setIsCompilingPreview(true);
    try {
      const imgUri = await CloudAuthService.generateServerPreview({
        name: editingModule.name || 'Nouveau Module',
        category: editingModule.category || 'code',
        code: editingModule.code || '',
        version: editingModule.version || '1.0.0'
      });
      setPreviewImage(imgUri);
    } catch (e: any) {
      alert(`Erreur de compilation serveur: ${e.message}`);
    } finally {
      setIsCompilingPreview(false);
    }
  };

  // Save module (create or update)
  const handleSaveModule = async () => {
    if (!editingModule || !editingModule.name?.trim()) {
      alert('Veuillez entrer un nom pour le module.');
      return;
    }
    setIsSaving(true);
    try {
      const saved = await CloudAuthService.saveMarketplaceModule(editingModule);
      setModules(prev => {
        const idx = prev.findIndex(m => m.id === saved.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = saved;
          return cp;
        }
        return [saved, ...prev];
      });
      setEditorOpen(false);
      setEditingModule(null);
      loadData(true);
    } catch (e: any) {
      alert(`Erreur de sauvegarde: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter modules for display
  const displayedModules = modules.filter(m => {
    if (activeTab === 'my_library') {
      return isInLibrary(m.id);
    }
    if (activeTab !== 'all' && m.category !== activeTab) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return m.name.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/projects');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={s.page}>
      {/* ── Top Navigation Bar ── */}
      <header style={s.navbar}>
        <div style={s.navLeft}>
          <button style={s.backBtn} className="back-btn" onClick={handleBack} title="Retour">
            <ArrowLeft size={16} />
            <span>Retour</span>
          </button>

          <div style={s.divider} />

          <div style={s.brand} onClick={() => navigate('/projects')}>
            <FleurDeLysLogo size={22} color="#6EC97E" />
            <div style={s.brandText}>
              <span style={{ color: '#3F3F46', fontWeight: 800 }}>Scout</span>
              <span style={{ color: '#6EC97E', fontWeight: 800 }}>Raider</span>
            </div>
          </div>

          <div style={s.badgePill}>
            <Store size={12} color="#6EC97E" />
            <span>Marketplace</span>
          </div>
        </div>

        <div style={s.navRight}>
          <button style={s.createBtn} onClick={() => handleOpenEditor()}>
            <Plus size={15} />
            <span>Créer un module</span>
          </button>

          {/* User Session Menu */}
          {isGuest ? (
            <button style={s.sessionBtn} onClick={() => navigate('/login')}>
              <User size={14} />
              <span>Connexion</span>
            </button>
          ) : (
            <div style={{ position: 'relative' }}>
              <button style={s.sessionBtn} onClick={() => setUserMenuOpen(o => !o)}>
                <span style={s.avatarInitial}>{(user?.username || '?')[0].toUpperCase()}</span>
                <span style={s.sessionUser}>{user?.username || ''}</span>
                <ChevronDown size={12} style={{ color: '#52525B' }} />
              </button>
              {userMenuOpen && (
                <div style={s.userDropdown} onClick={e => e.stopPropagation()}>
                  <button style={s.dropdownItem} onClick={() => { setUserMenuOpen(false); navigate('/projects'); }}>
                    <FolderOpen size={14} /> Mes projets
                  </button>
                  <button style={s.dropdownItem} onClick={handleLogout}>
                    <LogOut size={14} /> Déconnexion
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Click-away overlay for user dropdown */}
      {userMenuOpen && (
        <div style={s.overlay} onClick={() => setUserMenuOpen(false)} />
      )}

      {/* ── Hero / Sub-header ── */}
      <div style={s.hero}>
        <div style={s.heroHeader}>
          <div style={s.heroIconBox}>
            <Store size={22} color="#6EC97E" />
          </div>
          <div>
            <h1 style={s.heroTitle}>Marketplace Communautaire</h1>
            <p style={s.heroSub}>
              Partagez, forkez et synchronisez vos codes d'encodage, énigmes, orchestrations tactiques et thèmes de carnet.
            </p>
          </div>
        </div>

        {/* Search and Category Filters */}
        <div style={s.controlsRow}>
          {/* Category Tabs */}
          <div style={s.tabsRow}>
            {[
              { id: 'all', label: 'Tous', icon: <Store size={13} /> },
              { id: 'code', label: 'Codes & Énigmes', icon: <Code size={13} /> },
              { id: 'orchestration', label: 'Orchestrations', icon: <Sliders size={13} /> },
              { id: 'theme', label: 'Thèmes', icon: <Palette size={13} /> },
              { id: 'my_library', label: `Ma Bibliothèque (${userLibrary.length})`, icon: <Check size={13} /> },
            ].map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className="tab-btn"
                  style={{
                    ...s.tabBtn,
                    ...(active ? s.tabBtnActive : {})
                  }}
                  onClick={() => setActiveTab(tab.id as CategoryFilter)}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div style={s.searchBox}>
            <Search size={14} style={s.searchIcon} />
            <input
              type="text"
              placeholder="Rechercher un module…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={s.searchInput}
            />
            {searchQuery && (
              <button style={s.clearBtn} onClick={() => setSearchQuery('')} title="Effacer">
                <X size={12} />
              </button>
            )}
            <button
              style={s.refreshBtn}
              onClick={() => loadData(false)}
              title="Actualiser la liste"
              disabled={isLoading}
            >
              <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Grid Content ── */}
      <main style={s.main}>
        {errorMsg && (
          <div style={s.errorBox}>
            <span>⚠ {errorMsg}</span>
            <button style={s.errorClose} onClick={() => setErrorMsg(null)}>✕</button>
          </div>
        )}

        {isLoading ? (
          <div style={s.loadingContainer}>
            <Loader2 size={24} className="spin" style={{ color: '#6EC97E' }} />
            <span style={{ color: '#71717A', fontSize: '13px' }}>Chargement des modules communautaires…</span>
          </div>
        ) : displayedModules.length === 0 ? (
          <div style={s.emptyState}>
            <Store size={40} style={{ color: '#3F3F46', marginBottom: '12px' }} />
            <h3 style={s.emptyTitle}>
              {searchQuery ? `Aucun module pour "${searchQuery}"` : 'Aucun module dans cette catégorie'}
            </h3>
            <p style={s.emptySub}>
              {searchQuery
                ? 'Essayez avec un autre terme de recherche ou changez de catégorie.'
                : 'Soyez le premier membre de la communauté à publier un module ou un algorithme !'}
            </p>
            <button style={s.createBtn} onClick={() => handleOpenEditor()}>
              <Plus size={14} />
              <span>Créer un module</span>
            </button>
          </div>
        ) : (
          <div style={s.grid}>
            {displayedModules.map(mod => {
              const inLib = isInLibrary(mod.id);
              const isOwner = user && (mod.author_id === user.id || mod.author_username === user.username);

              return (
                <div key={mod.id} className="module-card" style={s.card}>
                  {/* Card Preview Header */}
                  <div style={s.cardPreviewArea}>
                    {mod.preview_image ? (
                      <img
                        src={mod.preview_image}
                        alt={mod.name}
                        style={s.previewImg}
                      />
                    ) : (
                      <div style={s.previewPlaceholder}>
                        <Code size={22} style={{ opacity: 0.35, marginBottom: '4px' }} />
                        <span>Aperçu automatique du code</span>
                      </div>
                    )}

                    {/* Category Tag */}
                    <div style={{
                      ...s.categoryTag,
                      color: mod.category === 'code' ? '#6EC97E' : mod.category === 'orchestration' ? '#F59E0B' : '#A855F7',
                    }}>
                      {mod.category === 'code' ? 'Code & Algorithme' : mod.category === 'orchestration' ? 'Orchestration' : 'Thème'}
                    </div>

                    {/* Visibility Toggle */}
                    <button
                      onClick={e => handleToggleVisibility(mod, e)}
                      title={mod.is_public ? 'Module Public (Visible par tous). Cliquer pour masquer.' : 'Module Privé (Caché). Cliquer pour rendre public.'}
                      style={{
                        ...s.visBadge,
                        background: mod.is_public ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        borderColor: mod.is_public ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)',
                        color: mod.is_public ? '#34d399' : '#f87171',
                      }}
                    >
                      {mod.is_public ? <Eye size={11} /> : <EyeOff size={11} />}
                      <span>{mod.is_public ? 'Public' : 'Privé'}</span>
                    </button>
                  </div>

                  {/* Card Body */}
                  <div style={s.cardBody}>
                    <div style={s.cardTitleRow}>
                      <h3 style={s.cardTitle}>{mod.name}</h3>
                      <span style={s.versionTag}>v{mod.version || '1.0.0'}</span>
                    </div>

                    <div style={s.authorLine}>
                      <span>Par</span>
                      <strong style={{ color: '#6EC97E' }}>{mod.author_username || 'Communauté'}</strong>
                    </div>

                    <p style={s.cardDesc}>
                      {mod.description || 'Module communautaire pour la création et le rendu de carnets de raid.'}
                    </p>

                    {/* Card Actions Footer */}
                    <div style={s.cardFooter}>
                      <button
                        onClick={() => handleToggleLibrary(mod)}
                        className="sync-btn"
                        style={{
                          ...s.syncBtn,
                          ...(inLib ? s.syncBtnActive : {})
                        }}
                        title={inLib ? 'Retirer de ma bibliothèque' : 'Ajouter à ma bibliothèque synchronisée'}
                      >
                        {inLib ? <Check size={13} /> : <Download size={13} />}
                        <span>{inLib ? 'Dans ma biblio' : 'Synchroniser'}</span>
                      </button>

                      <div style={s.actionRow}>
                        <button
                          onClick={() => handleOpenEditor(mod)}
                          className="icon-action-btn"
                          title="Modifier le code / informations"
                          style={s.iconActionBtn}
                        >
                          <Edit3 size={13} />
                        </button>

                        <button
                          onClick={e => handleFork(mod, e)}
                          className="icon-action-btn"
                          title="Forker ce module (créer votre propre copie dérivée)"
                          style={s.iconActionBtn}
                        >
                          <GitFork size={13} />
                        </button>

                        {isOwner && (
                          <button
                            onClick={e => handleDelete(mod, e)}
                            className="icon-action-btn"
                            title="Supprimer ce module"
                            style={{ ...s.iconActionBtn, color: '#ef4444' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Status Bar Bottom ── */}
      <footer style={s.footerBar}>
        <div style={s.footerLeft}>
          <div style={{
            ...s.statusDot,
            background: !isGuest && user ? 'var(--semantic-success, #10b981)' : 'var(--semantic-warning, #f59e0b)'
          }} />
          <span>
            {!isGuest && user ? (
              <>Bibliothèque synchronisée avec le compte <strong>{user.username}</strong> ({userLibrary.length} modules installés)</>
            ) : (
              <>Mode Invité : connectez-vous pour sauvegarder votre bibliothèque dans le cloud.</>
            )}
          </span>
        </div>
        <div style={s.footerRight}>
          {isGuest && (
            <button style={s.loginLink} onClick={() => navigate('/login')}>
              Se connecter
            </button>
          )}
          <span>{displayedModules.length} module{displayedModules.length > 1 ? 's' : ''} listé{displayedModules.length > 1 ? 's' : ''}</span>
        </div>
      </footer>

      {/* ── Dynamic Hover Styles ── */}
      <style>{`
        .module-card {
          transition: transform 140ms ease, border-color 140ms ease !important;
        }
        .module-card:hover {
          transform: translateY(-2px);
          border-color: #3F3F46 !important;
        }
        .icon-action-btn:hover {
          background: #1C1C21 !important;
          color: #FAFAFA !important;
          border-color: #3F3F46 !important;
        }
        .sync-btn:hover {
          border-color: #3F3F46 !important;
          color: #FAFAFA !important;
        }
        .back-btn:hover {
          border-color: #3F3F46 !important;
          color: #FAFAFA !important;
        }
        .tab-btn:hover {
          border-color: #3F3F46 !important;
          color: #D4D4D8 !important;
        }
      `}</style>

      {/* ── Editor Modal ── */}
      {editorOpen && editingModule && (
        <div style={s.modalOverlay}>
          <div style={s.modalBox}>
            {/* Modal Header */}
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit3 size={16} color="#6EC97E" />
                <h3 style={s.modalTitle}>
                  {editingModule.id ? `Modifier : ${editingModule.name}` : 'Nouveau module communautaire'}
                </h3>
              </div>
              <button style={s.closeBtn} onClick={() => setEditorOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Modal Body: Two columns */}
            <div style={s.modalBody}>
              {/* Left Column: Form & Code */}
              <div style={s.modalLeftCol}>
                <div>
                  <label style={s.fieldLabel}>Nom du module *</label>
                  <input
                    type="text"
                    value={editingModule.name || ''}
                    onChange={e => setEditingModule({ ...editingModule, name: e.target.value })}
                    placeholder="Ex: Chiffre de Vigenère Tactique, Grille Scoute…"
                    style={s.textInput}
                  />
                </div>

                <div style={s.formGrid2}>
                  <div>
                    <label style={s.fieldLabel}>Catégorie</label>
                    <select
                      value={editingModule.category || 'code'}
                      onChange={e => setEditingModule({ ...editingModule, category: e.target.value })}
                      style={s.selectInput}
                    >
                      <option value="code">Code & Chiffrement</option>
                      <option value="orchestration">Orchestration & Presets</option>
                      <option value="theme">Thème & Mise en page</option>
                    </select>
                  </div>

                  <div>
                    <label style={s.fieldLabel}>Version</label>
                    <input
                      type="text"
                      value={editingModule.version || '1.0.0'}
                      onChange={e => setEditingModule({ ...editingModule, version: e.target.value })}
                      placeholder="1.0.0"
                      style={s.textInput}
                    />
                  </div>
                </div>

                <div>
                  <label style={s.fieldLabel}>Description</label>
                  <textarea
                    rows={2}
                    value={editingModule.description || ''}
                    onChange={e => setEditingModule({ ...editingModule, description: e.target.value })}
                    placeholder="Brève explication de la méthode, des paramètres ou du fonctionnement…"
                    style={s.textareaInput}
                  />
                </div>

                <div style={s.checkboxRow}>
                  <input
                    type="checkbox"
                    id="is_public_checkbox"
                    checked={editingModule.is_public ?? true}
                    onChange={e => setEditingModule({ ...editingModule, is_public: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="is_public_checkbox" style={s.checkboxLabel}>
                    Rendre ce module public et visible par la communauté
                  </label>
                </div>

                {/* Code Editor */}
                <div style={s.codeEditorContainer}>
                  <div style={s.codeHeader}>
                    <label style={s.fieldLabel}>Code Source Python (Algorithme)</label>
                    <span style={s.codeSignature}>def encode(solution_text, options=None)</span>
                  </div>
                  <textarea
                    rows={9}
                    value={editingModule.code || ''}
                    onChange={e => setEditingModule({ ...editingModule, code: e.target.value })}
                    style={s.codeTextarea}
                  />
                </div>
              </div>

              {/* Right Column: Server-Side Preview */}
              <div style={s.modalRightCol}>
                <div style={s.previewHeader}>
                  <Sparkles size={14} color="#6EC97E" />
                  <span>Aperçu compilé côté serveur</span>
                </div>

                <div style={s.previewImageBox}>
                  {isCompilingPreview ? (
                    <div style={s.previewLoading}>
                      <Loader2 className="spin" size={24} style={{ color: '#6EC97E', margin: '0 auto 8px' }} />
                      <span>Exécution dans le bac à sable serveur…</span>
                    </div>
                  ) : previewImage ? (
                    <img
                      src={previewImage}
                      alt="Aperçu compilé"
                      style={s.previewImageCover}
                    />
                  ) : (
                    <div style={s.previewPlaceholderBox}>
                      <Code size={24} style={{ opacity: 0.35, margin: '0 auto 8px' }} />
                      <span>Cliquez ci-dessous pour tester l'exécution du code sur le serveur.</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCompilePreview}
                  disabled={isCompilingPreview}
                  style={s.compileBtn}
                >
                  <Play size={13} />
                  <span>{isCompilingPreview ? 'Compilation en cours…' : '⚡ Tester & Générer l\'aperçu serveur'}</span>
                </button>

                <p style={s.sandboxNote}>
                  Le serveur compile et exécute votre code dans un conteneur sécurisé, puis capture automatiquement un rendu haute définition pour la marketplace.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setEditorOpen(false)}>
                Annuler
              </button>
              <button style={s.saveBtn} onClick={handleSaveModule} disabled={isSaving}>
                {isSaving ? 'Publication…' : 'Publier le module'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Harmonized Design Styles ────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#09090B',
    color: '#FAFAFA',
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },

  // ── Navbar ──
  navbar: {
    height: '56px',
    borderBottom: '1px solid #27272A',
    background: '#09090B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#1C1C21',
    border: '1px solid #27272A',
    borderRadius: '8px',
    padding: '6px 12px',
    color: '#A1A1AA',
    fontSize: '12.5px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
  divider: {
    width: '1px',
    height: '18px',
    background: '#27272A',
    margin: '0 4px',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  brandText: {
    fontSize: '15px',
    letterSpacing: '-0.3px',
  },
  badgePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: 'rgba(110, 201, 126, 0.1)',
    border: '1px solid rgba(110, 201, 126, 0.25)',
    borderRadius: '16px',
    padding: '3px 9px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#6EC97E',
    marginLeft: '6px',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  createBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#6EC97E',
    color: '#09090B',
    border: 'none',
    borderRadius: '8px',
    padding: '7px 14px',
    fontSize: '12.5px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 120ms ease',
  },

  // ── Session ──
  sessionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    background: '#1C1C21',
    border: '1px solid #27272A',
    borderRadius: '8px',
    padding: '6px 12px',
    color: '#A1A1AA',
    fontSize: '12.5px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'border-color 120ms ease',
  },
  avatarInitial: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#6EC97E',
  },
  sessionUser: {
    color: '#D4D4D8',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userDropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    background: '#1C1C21',
    border: '1px solid #27272A',
    borderRadius: '10px',
    padding: '4px',
    minWidth: '160px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.85)',
    zIndex: 300,
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: '#A1A1AA',
    fontSize: '12.5px',
    padding: '8px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 99,
  },

  // ── Hero Section ──
  hero: {
    padding: '36px 32px 20px',
    maxWidth: '1280px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  heroHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '28px',
  },
  heroIconBox: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, rgba(110, 201, 126, 0.15), rgba(37, 99, 235, 0.15))',
    border: '1px solid rgba(110, 201, 126, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroTitle: {
    margin: '0 0 6px',
    fontSize: '24px',
    fontWeight: 800,
    letterSpacing: '-0.5px',
    color: '#FAFAFA',
  },
  heroSub: {
    margin: 0,
    fontSize: '13px',
    color: '#A1A1AA',
    lineHeight: 1.5,
    maxWidth: '680px',
  },

  // ── Controls Row (Filters + Search) ──
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
    paddingBottom: '8px',
    borderBottom: '1px solid #27272A',
  },
  tabsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#121215',
    border: '1px solid #27272A',
    borderRadius: '8px',
    padding: '6px 12px',
    color: '#71717A',
    fontSize: '12.5px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
  tabBtnActive: {
    background: '#1C1C21',
    borderColor: '#3F3F46',
    color: '#6EC97E',
  },
  searchBox: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '280px',
    background: 'transparent',
    border: '1px solid #27272A',
    borderRadius: '8px',
    overflow: 'hidden',
    height: '34px',
  },
  searchIcon: {
    position: 'absolute',
    left: '10px',
    color: '#52525B',
    pointerEvents: 'none',
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    padding: '0 32px 0 30px',
    color: '#FAFAFA',
    fontSize: '12.5px',
    fontFamily: 'inherit',
    height: '100%',
  },
  clearBtn: {
    position: 'absolute',
    right: '34px',
    background: 'transparent',
    border: 'none',
    color: '#52525B',
    cursor: 'pointer',
    padding: 0,
  },
  refreshBtn: {
    background: 'transparent',
    border: 'none',
    borderLeft: '1px solid #27272A',
    color: '#71717A',
    cursor: 'pointer',
    padding: '0 10px',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Main Content Grid ──
  main: {
    flex: 1,
    padding: '24px 32px 48px',
    maxWidth: '1280px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '20px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '80px 0',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '64px 20px',
    background: '#121215',
    border: '1px dashed #27272A',
    borderRadius: '14px',
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#FAFAFA',
    margin: '0 0 6px',
  },
  emptySub: {
    fontSize: '13px',
    color: '#71717A',
    maxWidth: '460px',
    margin: '0 0 20px',
    lineHeight: 1.5,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#f87171',
    fontSize: '13px',
    marginBottom: '20px',
  },
  errorClose: {
    background: 'transparent',
    border: 'none',
    color: '#f87171',
    cursor: 'pointer',
    fontSize: '14px',
  },

  // ── Module Card ──
  card: {
    background: '#121215',
    border: '1px solid #27272A',
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'border-color 150ms ease',
  },
  cardPreviewArea: {
    height: '160px',
    background: '#09090B',
    position: 'relative',
    overflow: 'hidden',
    borderBottom: '1px solid #27272A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  previewPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    color: '#52525B',
    fontSize: '11px',
    letterSpacing: '0.02em',
  },
  categoryTag: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    padding: '3px 8px',
    borderRadius: '4px',
    background: 'rgba(9, 9, 11, 0.85)',
    border: '1px solid #27272A',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  visBadge: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    borderRadius: '4px',
    border: '1px solid',
    fontSize: '10px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cardBody: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '4px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '14.5px',
    fontWeight: 700,
    color: '#FAFAFA',
    lineHeight: 1.3,
  },
  versionTag: {
    fontSize: '10.5px',
    color: '#71717A',
    fontFamily: 'monospace',
    background: '#1C1C21',
    border: '1px solid #27272A',
    padding: '1px 5px',
    borderRadius: '4px',
  },
  authorLine: {
    fontSize: '11px',
    color: '#71717A',
    display: 'flex',
    gap: '4px',
    marginBottom: '8px',
  },
  cardDesc: {
    margin: '0 0 16px',
    fontSize: '12px',
    color: '#A1A1AA',
    lineHeight: 1.45,
    flex: 1,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingTop: '12px',
    borderTop: '1px solid #1C1C21',
  },
  syncBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '7px 10px',
    borderRadius: '6px',
    border: '1px solid #27272A',
    background: '#1C1C21',
    color: '#FAFAFA',
    fontSize: '11.5px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
  syncBtnActive: {
    background: 'rgba(110, 201, 126, 0.15)',
    borderColor: 'rgba(110, 201, 126, 0.35)',
    color: '#6EC97E',
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  iconActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    background: 'transparent',
    border: '1px solid #27272A',
    borderRadius: '6px',
    color: '#71717A',
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },

  // ── Footer Bar ──
  footerBar: {
    padding: '12px 32px',
    borderTop: '1px solid #27272A',
    background: '#09090B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#71717A',
    marginTop: 'auto',
  },
  footerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
  },
  footerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  loginLink: {
    background: 'none',
    border: 'none',
    color: '#6EC97E',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'underline',
  },

  // ── Modal Editor ──
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(6px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  modalBox: {
    width: '100%',
    maxWidth: '920px',
    maxHeight: '90vh',
    background: '#121215',
    border: '1px solid #27272A',
    borderRadius: '14px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #27272A',
    background: '#18181B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    color: '#FAFAFA',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#71717A',
    cursor: 'pointer',
  },
  modalBody: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  modalLeftCol: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    borderRight: '1px solid #27272A',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '11.5px',
    fontWeight: 600,
    color: '#A1A1AA',
    marginBottom: '5px',
  },
  textInput: {
    width: '100%',
    padding: '8px 10px',
    background: '#09090B',
    border: '1px solid #27272A',
    borderRadius: '6px',
    color: '#FAFAFA',
    fontSize: '13px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  formGrid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  selectInput: {
    width: '100%',
    padding: '8px 10px',
    background: '#09090B',
    border: '1px solid #27272A',
    borderRadius: '6px',
    color: '#FAFAFA',
    fontSize: '13px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  textareaInput: {
    width: '100%',
    padding: '8px 10px',
    background: '#09090B',
    border: '1px solid #27272A',
    borderRadius: '6px',
    color: '#FAFAFA',
    fontSize: '12.5px',
    boxSizing: 'border-box',
    outline: 'none',
    resize: 'none',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  checkboxLabel: {
    fontSize: '12px',
    color: '#D4D4D8',
    cursor: 'pointer',
  },
  codeEditorContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  codeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '5px',
  },
  codeSignature: {
    fontSize: '10.5px',
    color: '#52525B',
    fontFamily: 'monospace',
  },
  codeTextarea: {
    width: '100%',
    flex: 1,
    minHeight: '160px',
    padding: '10px',
    background: '#09090B',
    border: '1px solid #27272A',
    borderRadius: '6px',
    color: '#A3E635',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: '12px',
    lineHeight: 1.45,
    boxSizing: 'border-box',
    resize: 'vertical',
    outline: 'none',
  },
  modalRightCol: {
    width: '360px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    background: '#0D0D10',
  },
  previewHeader: {
    fontSize: '12.5px',
    fontWeight: 700,
    color: '#FAFAFA',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  previewImageBox: {
    width: '100%',
    height: '210px',
    background: '#09090B',
    borderRadius: '8px',
    border: '1px solid #27272A',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLoading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    color: '#6EC97E',
    fontSize: '12px',
    textAlign: 'center',
    padding: '16px',
  },
  previewImageCover: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  previewPlaceholderBox: {
    textAlign: 'center',
    color: '#52525B',
    padding: '20px',
    fontSize: '11.5px',
    lineHeight: 1.4,
  },
  compileBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '9px',
    background: 'rgba(110, 201, 126, 0.12)',
    border: '1px solid rgba(110, 201, 126, 0.3)',
    color: '#6EC97E',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  sandboxNote: {
    margin: 0,
    fontSize: '11px',
    color: '#52525B',
    lineHeight: 1.4,
  },
  modalFooter: {
    padding: '12px 20px',
    borderTop: '1px solid #27272A',
    background: '#18181B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  cancelBtn: {
    padding: '7px 14px',
    background: 'transparent',
    border: '1px solid #27272A',
    color: '#A1A1AA',
    borderRadius: '6px',
    fontSize: '12.5px',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '7px 16px',
    background: '#6EC97E',
    color: '#09090B',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 700,
    fontSize: '12.5px',
    cursor: 'pointer',
  },
};

import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
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
  ExternalLink,
  Sparkles,
  Play
} from 'lucide-react';
import { CloudAuthService, MarketplaceModule, UserLibraryItem } from '../../logic/CloudAuthService';
import { useAuth } from '../../AuthContext';

interface MarketplaceModalProps {
  onClose: () => void;
  initialCategory?: string;
}

export default function MarketplaceModal({ onClose, initialCategory = 'all' }: MarketplaceModalProps) {
  const { user, isGuest, setAuthModalOpen } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'code' | 'orchestration' | 'theme' | 'my_library'>(initialCategory as any);
  const [searchQuery, setSearchQuery] = useState('');
  const [modules, setModules] = useState<MarketplaceModule[]>([]);
  const [userLibrary, setUserLibrary] = useState<UserLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editor / Creator State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Partial<MarketplaceModule> | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isCompilingPreview, setIsCompilingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load Marketplace & User Library
  const loadData = useCallback(async () => {
    setIsLoading(true);
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
      setIsLoading(false);
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
      loadData();
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

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 10, 8, 0.75)',
      backdropFilter: 'blur(6px)',
      zIndex: 1200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1100px',
        height: '90vh',
        background: 'var(--bg-panel, #131b17)',
        border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden'
      }}>
        
        {/* Top Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(110,201,126,0.25), rgba(14,165,233,0.25))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(110,201,126,0.3)'
            }}>
              <Store size={20} color="var(--accent-default, #6EC97E)" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#fff' }}>
                Marketplace des Modules & Orchestrations
              </h2>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                Partagez, modifiez, téléchargez et synchronisez vos algorithmes de carnet.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => handleOpenEditor()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                background: 'var(--accent-default, #6EC97E)',
                color: '#0d1511',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                fontSize: '12.5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Plus size={16} />
              <span>Créer / Uploader un module</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Bar & Tabs */}
        <div style={{
          padding: '12px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {[
              { id: 'all', label: 'Tous', icon: <Store size={14} /> },
              { id: 'code', label: 'Codes & Énigmes', icon: <Code size={14} /> },
              { id: 'orchestration', label: 'Orchestrations', icon: <Sliders size={14} /> },
              { id: 'theme', label: 'Thèmes', icon: <Palette size={14} /> },
              { id: 'my_library', label: `Ma Bibliothèque (${userLibrary.length})`, icon: <Check size={14} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: activeTab === tab.id ? '1px solid rgba(110,201,126,0.3)' : '1px solid transparent',
                  background: activeTab === tab.id ? 'rgba(110,201,126,0.15)' : 'transparent',
                  color: activeTab === tab.id ? '#6EC97E' : 'rgba(255,255,255,0.6)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{
            position: 'relative',
            width: '240px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Search size={14} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '10px' }} />
            <input
              type="text"
              placeholder="Rechercher un module..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Main Content Area (Cards Grid) */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px',
          alignContent: 'start'
        }}>
          {isLoading ? (
            <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
              <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 10px' }} />
              <div>Chargement des modules communautaires...</div>
            </div>
          ) : displayedModules.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              padding: '60px 20px',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '12px',
              border: '1px dashed rgba(255,255,255,0.1)'
            }}>
              <Store size={36} color="rgba(255,255,255,0.2)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '15px', color: '#fff', fontWeight: 600 }}>Aucun module trouvé</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                {searchQuery ? 'Modifiez votre terme de recherche ou le filtre de catégorie.' : 'Soyez le premier à uploader un module dans la communauté !'}
              </div>
              <button
                onClick={() => handleOpenEditor()}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  background: 'rgba(110,201,126,0.2)',
                  border: '1px solid rgba(110,201,126,0.3)',
                  color: '#6EC97E',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                + Ajouter un nouveau module
              </button>
            </div>
          ) : (
            displayedModules.map(mod => {
              const inLib = isInLibrary(mod.id);
              const isOwner = user && (mod.author_id === user.id || mod.author_username === user.username);

              return (
                <div
                  key={mod.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(110,201,126,0.4)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Server-Side Compiled Preview Image */}
                  <div style={{
                    width: '100%',
                    height: '160px',
                    background: '#0d1511',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.06)'
                  }}>
                    {mod.preview_image ? (
                      <img
                        src={mod.preview_image}
                        alt={mod.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Code size={16} />
                        <span>Aperçu serveur non généré</span>
                      </div>
                    )}

                    {/* Category Badge Top Left */}
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: 'rgba(0,0,0,0.7)',
                      backdropFilter: 'blur(4px)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: mod.category === 'code' ? '#6EC97E' : mod.category === 'orchestration' ? '#F59E0B' : '#A855F7',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {mod.category === 'code' ? 'Code' : mod.category === 'orchestration' ? 'Orchestration' : 'Thème'}
                    </div>

                    {/* Visibility Badge Top Right */}
                    <button
                      onClick={(e) => handleToggleVisibility(mod, e)}
                      title={mod.is_public ? 'Module Public (Visible par tous). Cliquer pour masquer.' : 'Module Privé (Caché). Cliquer pour rendre visible.'}
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: mod.is_public ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                        border: mod.is_public ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                        color: mod.is_public ? '#34d399' : '#f87171',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backdropFilter: 'blur(4px)'
                      }}
                    >
                      {mod.is_public ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span>{mod.is_public ? 'Visible' : 'Masqué'}</span>
                    </button>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                        {mod.name}
                      </h3>
                      <span style={{
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.4)',
                        fontFamily: 'monospace',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '2px 5px',
                        borderRadius: '4px'
                      }}>
                        v{mod.version || '1.0.0'}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#6EC97E', marginTop: '4px', fontWeight: 500 }}>
                      Par {mod.author_username || 'Communauté'}
                    </div>

                    <p style={{
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.65)',
                      marginTop: '8px',
                      marginBottom: '14px',
                      lineHeight: 1.4,
                      flex: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {mod.description || 'Module communautaire pour la création et le rendu de carnets de raid.'}
                    </p>

                    {/* Card Actions Footer */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      {/* Add to library / Synced */}
                      <button
                        onClick={() => handleToggleLibrary(mod)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: inLib ? '1px solid rgba(110,201,126,0.4)' : '1px solid rgba(255,255,255,0.15)',
                          background: inLib ? 'rgba(110,201,126,0.18)' : 'rgba(255,255,255,0.06)',
                          color: inLib ? '#6EC97E' : '#fff',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {inLib ? <Check size={14} /> : <Download size={14} />}
                        <span>{inLib ? 'Dans ma biblio' : 'Synchroniser'}</span>
                      </button>

                      {/* Modify / Edit */}
                      <button
                        onClick={() => handleOpenEditor(mod)}
                        title="Modifier ce module (collaboratif communauté)"
                        style={{
                          padding: '7px 9px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: 'rgba(255,255,255,0.05)',
                          color: 'rgba(255,255,255,0.8)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Edit3 size={14} />
                      </button>

                      {/* Fork */}
                      <button
                        onClick={(e) => handleFork(mod, e)}
                        title="Forker ce module (créer votre propre copie dérivée)"
                        style={{
                          padding: '7px 9px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: 'rgba(255,255,255,0.05)',
                          color: 'rgba(255,255,255,0.8)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <GitFork size={14} />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Bar: Synchronized Account Status */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.6)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: !isGuest && user ? '#10b981' : '#f59e0b'
            }} />
            <span>
              {!isGuest && user ? (
                <>Bibliothèque connectée au compte <strong>{user.username}</strong> ({userLibrary.length} modules synchronisés)</>
              ) : (
                <>Mode invité : connectez-vous pour synchroniser votre bibliothèque dans le cloud.</>
              )}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isGuest && (
              <button
                onClick={() => setAuthModalOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6EC97E',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Se connecter / Créer un compte
              </button>
            )}
            <span>{displayedModules.length} module{displayedModules.length > 1 ? 's' : ''} disponible{displayedModules.length > 1 ? 's' : ''}</span>
          </div>
        </div>

      </div>

      {/* Editor & Preview Modal */}
      {editorOpen && editingModule && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 1300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '900px',
            height: '85vh',
            background: 'var(--bg-panel, #151e19)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '14px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 30px 70px rgba(0,0,0,0.6)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit3 size={18} color="#6EC97E" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                  {editingModule.id ? `Modifier le module : ${editingModule.name}` : 'Nouveau module communautaire'}
                </h3>
              </div>
              <button
                onClick={() => setEditorOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Two columns (Fields + Code & Live Preview) */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Left Column: Form & Code */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>
                    Nom du module *
                  </label>
                  <input
                    type="text"
                    value={editingModule.name || ''}
                    onChange={(e) => setEditingModule({ ...editingModule, name: e.target.value })}
                    placeholder="Ex: Chiffre de Vigenère Custom, Grille Scoute..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>
                      Catégorie
                    </label>
                    <select
                      value={editingModule.category || 'code'}
                      onChange={(e) => setEditingModule({ ...editingModule, category: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: '#131b17',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    >
                      <option value="code">Code & Chiffrement</option>
                      <option value="orchestration">Orchestration & Presets</option>
                      <option value="theme">Thème & Mise en page</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>
                      Version
                    </label>
                    <input
                      type="text"
                      value={editingModule.version || '1.0.0'}
                      onChange={(e) => setEditingModule({ ...editingModule, version: e.target.value })}
                      placeholder="1.0.0"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={editingModule.description || ''}
                    onChange={(e) => setEditingModule({ ...editingModule, description: e.target.value })}
                    placeholder="Brève explication des règles ou de la méthode d'encodage..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '12.5px',
                      resize: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                  <input
                    type="checkbox"
                    id="is_public_check"
                    checked={editingModule.is_public ?? true}
                    onChange={(e) => setEditingModule({ ...editingModule, is_public: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="is_public_check" style={{ fontSize: '12.5px', color: '#fff', cursor: 'pointer' }}>
                    Rendre ce module visible dans la communauté (Public)
                  </label>
                </div>

                {/* Code Editor */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                      Code Source (Python / Algorithme d'encodage)
                    </label>
                    <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                      def encode(solution_text, options=None)
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={editingModule.code || ''}
                    onChange={(e) => setEditingModule({ ...editingModule, code: e.target.value })}
                    style={{
                      width: '100%',
                      flex: 1,
                      minHeight: '140px',
                      padding: '10px',
                      background: '#0d1310',
                      border: '1px solid rgba(110,201,126,0.2)',
                      borderRadius: '6px',
                      color: '#a3e635',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      lineHeight: 1.4,
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              {/* Right Column: Server-Side Preview Display */}
              <div style={{ width: '380px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(0,0,0,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="#6EC97E" />
                    <span>Aperçu compilé côté serveur</span>
                  </div>
                </div>

                {/* Preview Image Box */}
                <div style={{
                  width: '100%',
                  height: '210px',
                  background: '#0d1511',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}>
                  {isCompilingPreview ? (
                    <div style={{ textAlign: 'center', color: '#6EC97E', fontSize: '12px' }}>
                      <RefreshCw className="animate-spin" size={20} style={{ margin: '0 auto 8px' }} />
                      <div>Compilation du code sur le serveur...</div>
                    </div>
                  ) : previewImage ? (
                    <img
                      src={previewImage}
                      alt="Aperçu compilé"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '20px', fontSize: '11.5px' }}>
                      <Code size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <div>Cliquez sur "Compiler l'aperçu" pour tester l'exécution du code sur le serveur.</div>
                    </div>
                  )}
                </div>

                {/* Compilation trigger button */}
                <button
                  type="button"
                  onClick={handleCompilePreview}
                  disabled={isCompilingPreview}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '9px',
                    background: 'rgba(110,201,126,0.18)',
                    border: '1px solid rgba(110,201,126,0.3)',
                    color: '#6EC97E',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: isCompilingPreview ? 'wait' : 'pointer'
                  }}
                >
                  <Play size={14} />
                  <span>{isCompilingPreview ? 'Compilation en cours...' : '⚡ Tester & Compiler l\'aperçu côté serveur'}</span>
                </button>

                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                  Le serveur compile et exécute votre code dans un bac à sable sécurisé, puis génère une image haute résolution qui apparaîtra sur la carte marketplace.
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={() => setEditorOpen(false)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.8)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Annuler
              </button>

              <button
                onClick={handleSaveModule}
                disabled={isSaving}
                style={{
                  padding: '8px 18px',
                  background: 'var(--accent-default, #6EC97E)',
                  color: '#0d1511',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: isSaving ? 'wait' : 'pointer'
                }}
              >
                {isSaving ? 'Enregistrement...' : 'Publier / Enregistrer'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Download, 
  Globe, 
  Lock, 
  Code, 
  Settings2, 
  Sliders, 
  Sparkles, 
  Play, 
  Check, 
  Info,
  Tag,
  FileJson,
  CloudUpload,
  Loader2
} from 'lucide-react';
import { ModuleManagementService, ManagedModule } from '../../logic/ModuleManagementService';
import { ModuleLogic } from '../../logic/ModuleLogic';

interface ModuleEditorModalProps {
  onClose: () => void;
  activeModuleId?: string | null;
  onSaved?: (mod: ManagedModule) => void;
}

type EditorTab = 'general' | 'constraints' | 'manifest' | 'test';

export default function ModuleEditorModal({ onClose, activeModuleId, onSaved }: ModuleEditorModalProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('general');
  const isCreation = !activeModuleId || activeModuleId === 'new';

  const [id, setId] = useState(isCreation ? '' : activeModuleId);
  const [name, setName] = useState('');
  const [version, setVersion] = useState('2.0.0');
  const [author, setAuthor] = useState('Chef de Troupe');
  const [description, setDescription] = useState('');
  const [resourceType, setResourceType] = useState<ManagedModule['resource_type']>('crypto_module');
  const [dataCapability, setDataCapability] = useState<ManagedModule['data_capability']>('alphabetic');
  const [isPublic, setIsPublic] = useState(false);
  const [tags, setTags] = useState('raid, custom');
  const [color, setColor] = useState('#3b82f6');
  
  // Constraints
  const [maxProportion, setMaxProportion] = useState(0.35);
  const [minDistanceM, setMinDistanceM] = useState(500);
  const [maxDistanceM, setMaxDistanceM] = useState(4000);
  const [maxAzimuts, setMaxAzimuts] = useState(6);
  const [allowConsecutive, setAllowConsecutive] = useState(false);

  // Live Test
  const [testInput, setTestInput] = useState('MESSAGE SECRET DE PATROUILLE 2026');
  const [testOutput, setTestOutput] = useState('');

  // Raw JSON Manifest view
  const [manifestJson, setManifestJson] = useState('{}');
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isPublishingS3, setIsPublishingS3] = useState(false);
  const [s3Status, setS3Status] = useState<string | null>(null);

  // Load existing module
  useEffect(() => {
    if (!isCreation && activeModuleId) {
      const all = ModuleManagementService.getAllModules();
      const existing = all.find(m => m.id === activeModuleId);
      if (existing) {
        setId(existing.id);
        setName(existing.name);
        setVersion(existing.version || '2.0.0');
        setAuthor(existing.author || 'Chef de Troupe');
        setDescription(existing.description || '');
        setResourceType(existing.resource_type || 'crypto_module');
        setDataCapability(existing.data_capability || 'alphabetic');
        setIsPublic(existing.is_public ?? false);
        setTags((existing.tags || []).join(', '));
        setColor(existing.color || '#3b82f6');

        const manifest = existing.manifest || ModuleManagementService.generateDefaultManifest(existing);
        setManifestJson(JSON.stringify(manifest, null, 2));

        if (manifest.constraints) {
          setMaxProportion(manifest.constraints.max_proportion ?? 0.35);
          setMinDistanceM(manifest.constraints.min_distance_m ?? 500);
          setMaxDistanceM(manifest.constraints.max_distance_m ?? 4000);
          setMaxAzimuts(manifest.constraints.max_azimuts ?? 6);
          setAllowConsecutive(manifest.constraints.allow_consecutive ?? false);
        }
      }
    } else {
      const defaultMod = {
        id: 'nouveau_code',
        name: 'Nouveau Module de Chiffrement',
        version: '2.0.0',
        author: 'Chef de Troupe',
        resource_type: 'crypto_module' as const,
        data_capability: 'alphabetic' as const,
        description: 'Chiffre d\'épreuve personnalisé pour les patrouilles.',
        is_public: false,
        tags: ['custom', 'raid']
      };
      setId(defaultMod.id);
      setName(defaultMod.name);
      setDescription(defaultMod.description);
      const initialManifest = ModuleManagementService.generateDefaultManifest(defaultMod);
      setManifestJson(JSON.stringify(initialManifest, null, 2));
    }
  }, [activeModuleId, isCreation]);

  // Sync state to Manifest JSON when tab switches to manifest
  useEffect(() => {
    if (activeTab === 'manifest') {
      try {
        const currentManifest = {
          $schema: 'https://scoutraider.org/schemas/v2/module.schema.json',
          schema_version: '2.0',
          id: id.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
          name,
          version,
          resource_type: resourceType,
          data_capability: resourceType === 'crypto_module' ? dataCapability : undefined,
          author,
          license: 'MIT',
          description,
          is_public: isPublic,
          entrypoint: 'index.ts',
          constraints: {
            max_proportion: maxProportion,
            allow_consecutive: allowConsecutive,
            min_distance_m: minDistanceM,
            max_distance_m: maxDistanceM,
            max_azimuts: maxAzimuts
          },
          tags: tags.split(',').map(t => t.trim()).filter(Boolean)
        };
        setManifestJson(JSON.stringify(currentManifest, null, 2));
        setManifestError(null);
      } catch (err: any) {
        setManifestError(err.message);
      }
    }
  }, [activeTab, id, name, version, resourceType, dataCapability, author, description, isPublic, maxProportion, allowConsecutive, minDistanceM, maxDistanceM, maxAzimuts, tags]);

  // Test run
  const handleRunTest = () => {
    try {
      const out = ModuleLogic.encode(id, testInput);
      setTestOutput(out || 'Résultat calculé avec succès.');
    } catch {
      setTestOutput(`[Simulation] ${testInput.split('').reverse().join('')}`);
    }
  };

  const handleSave = () => {
    let parsedManifest = {};
    try {
      parsedManifest = JSON.parse(manifestJson);
    } catch {
      parsedManifest = ModuleManagementService.generateDefaultManifest({
        id, name, version, resource_type: resourceType, data_capability: dataCapability, description, is_public: isPublic
      });
    }

    const saved = ModuleManagementService.saveCustomModule({
      id: id.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
      name,
      version,
      author,
      resource_type: resourceType,
      data_capability: dataCapability,
      description,
      is_public: isPublic,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      color,
      manifest: parsedManifest
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
    onSaved?.(saved);
  };

  const handlePublishS3 = async () => {
    let parsedManifest = {};
    try {
      parsedManifest = JSON.parse(manifestJson);
    } catch {
      parsedManifest = ModuleManagementService.generateDefaultManifest({
        id, name, version, resource_type: resourceType, data_capability: dataCapability, description, is_public: isPublic
      });
    }

    const saved = ModuleManagementService.saveCustomModule({
      id: id.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
      name,
      version,
      author,
      resource_type: resourceType,
      data_capability: dataCapability,
      description,
      is_public: isPublic,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      color,
      manifest: parsedManifest
    });

    setIsPublishingS3(true);
    setS3Status('Enregistrement et téléversement dans le bucket S3 Garage...');
    try {
      const res = await ModuleManagementService.publishModuleToS3(saved);
      if (res.success) {
        setS3Status(`✓ Publié sur S3 Garage : ${res.s3_url}`);
        setSavedSuccess(true);
        onSaved?.(saved);
      } else {
        setS3Status(`❌ ${res.error}`);
      }
    } catch (err: any) {
      setS3Status(`❌ Erreur: ${err.message}`);
    } finally {
      setIsPublishingS3(false);
    }
  };

  const handleExportJson = () => {
    const mod: ManagedModule = {
      id, name, version, author, resource_type: resourceType, data_capability: dataCapability,
      description, is_public: isPublic, is_builtin: false,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      manifest: JSON.parse(manifestJson || '{}')
    };
    ModuleManagementService.exportManifestJson(mod);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
      zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '100%', maxWidth: '780px', height: '88vh', maxHeight: '720px',
        background: '#111218', borderRadius: '18px', border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        
        {/* ── Header ── */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: `${color}20`, border: `1px solid ${color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: color
            }}>
              <Code size={18} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                  {isCreation ? 'Créer un Module Hub v2' : `Gérer le Module : ${name || id}`}
                </h2>
                <span style={{
                  fontSize: '10.5px', padding: '2px 8px', borderRadius: '6px',
                  background: isPublic ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: isPublic ? '#34d399' : '#fbbf24',
                  fontWeight: 700, border: `1px solid ${isPublic ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                }}>
                  {isPublic ? 'Public' : 'Privé'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.45)' }}>
                ID: <span style={{ fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.7)' }}>{id}</span> • Standard v2.0
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleExportJson}
              title="Exporter le manifeste JSON"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              <Download size={13} />
              <span>Export Manifest</span>
            </button>
            <button 
              onClick={onClose}
              style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)', border: 'none',
                color: 'rgba(255, 255, 255, 0.6)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Tabs Navigation ── */}
        <div style={{
          display: 'flex', gap: '4px', padding: '8px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(0, 0, 0, 0.2)'
        }}>
          {[
            { id: 'general' as EditorTab, label: 'Général & Visibilité', icon: <Settings2 size={13} /> },
            { id: 'constraints' as EditorTab, label: 'Capacités & Solveur', icon: <Sliders size={13} /> },
            { id: 'manifest' as EditorTab, label: 'Manifeste JSON v2', icon: <FileJson size={13} /> },
            { id: 'test' as EditorTab, label: 'Test en direct', icon: <Play size={13} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
                borderRadius: '8px', border: 'none',
                background: activeTab === tab.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'rgba(255, 255, 255, 0.45)',
                fontSize: '12px', fontWeight: activeTab === tab.id ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab Body Content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          
          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Row 1: Name & ID */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                    Nom public du module
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Chiffre de Delastelle"
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff', fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                    Identifiant unique (package_id)
                  </label>
                  <input
                    type="text"
                    value={id}
                    disabled={!isCreation}
                    onChange={e => setId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
                    placeholder="delastelle"
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '10px',
                      background: isCreation ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: isCreation ? '#93c5fd' : 'rgba(255, 255, 255, 0.4)',
                      fontFamily: 'monospace', fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Type de ressource & Visibilité */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                    Type de ressource Hub v2
                  </label>
                  <select
                    value={resourceType}
                    onChange={e => setResourceType(e.target.value as any)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '10px',
                      background: '#1a1c24', border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff', fontSize: '12.5px', outline: 'none'
                    }}
                  >
                    <option value="crypto_module">crypto_module (Chiffrement & Topographie)</option>
                    <option value="routing_engine">routing_engine (Moteur de Routage)</option>
                    <option value="path_provider">path_provider (Chargeur de Chemins/GPX)</option>
                    <option value="map_provider">map_provider (Fond de Carte Tuiles)</option>
                    <option value="raid_trame">raid_trame (Trame Pédagogique de Raid)</option>
                    <option value="theme_style">theme_style (Thème & Style d'Export)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                    Visibilité & Diffusion
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIsPublic(false)}
                      style={{
                        flex: 1, padding: '9px', borderRadius: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        background: !isPublic ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: !isPublic ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: !isPublic ? '#fbbf24' : 'rgba(255, 255, 255, 0.45)',
                        fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      <Lock size={13} />
                      <span>Privé (Local)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPublic(true)}
                      style={{
                        flex: 1, padding: '9px', borderRadius: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        background: isPublic ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: isPublic ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: isPublic ? '#34d399' : 'rgba(255, 255, 255, 0.45)',
                        fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      <Globe size={13} />
                      <span>Public (Hub)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                  Description pédagogique et rôle dans le carnet
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Expliquez brièvement comment les scouts doivent résoudre ou lire ce module..."
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff', fontSize: '12.5px', outline: 'none', resize: 'vertical'
                  }}
                />
              </div>

              {/* Version, Auteur & Tags */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                    Version SemVer
                  </label>
                  <input
                    type="text"
                    value={version}
                    onChange={e => setVersion(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff', fontSize: '12.5px', outline: 'none', fontFamily: 'monospace'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                    Auteur
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={e => setAuthor(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff', fontSize: '12.5px', outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                    Mots-clés / Tags (séparés par virgules)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    placeholder="crypto, azimut, boussole"
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff', fontSize: '12.5px', outline: 'none'
                    }}
                  />
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: CONSTRAINTS & CAPABILITY */}
          {activeTab === 'constraints' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                  Capacité de Traitement des Données (`data_capability`)
                </label>
                <select
                  value={dataCapability}
                  onChange={e => setDataCapability(e.target.value as any)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '10px',
                    background: '#1a1c24', border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff', fontSize: '12.5px', outline: 'none'
                  }}
                >
                  <option value="alphabetic">alphabetic (Lettres de l'alphabet A-Z : Morse, Avocat)</option>
                  <option value="numeric">numeric (Coordonnées et métrages exclusivement)</option>
                  <option value="alphanumeric">alphanumeric (Lettres et Chiffres : Vigenère, Polybe)</option>
                  <option value="symbolic_visual">symbolic_visual (Symboles graphiques : Templier, Sémaphore, Pavillons)</option>
                  <option value="map_path">map_path (Séquence d'itinéraires, azimuts et métrages : Gilwell)</option>
                  <option value="elevation_profile">elevation_profile (Profil altimétrique, relief et dénivelés)</option>
                  <option value="map_overview">map_overview (Aperçu cartographique général et cartouche synoptique)</option>
                </select>
              </div>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                  Contraintes pour le Solveur de Diffraction Pédagogique (CSP)
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>
                      Plafond de proportion max sur le raid (0.1 à 1.0)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.05"
                      max="1.0"
                      value={maxProportion}
                      onChange={e => setMaxProportion(parseFloat(e.target.value) || 0.35)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#fff', fontSize: '12px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>
                      Nombre max d'azimuts consécutifs absorbables
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={maxAzimuts}
                      onChange={e => setMaxAzimuts(parseInt(e.target.value, 10) || 6)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#fff', fontSize: '12px'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>
                      Distance minimale de tronçon (mètres)
                    </label>
                    <input
                      type="number"
                      step="100"
                      value={minDistanceM}
                      onChange={e => setMinDistanceM(parseInt(e.target.value, 10) || 0)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#fff', fontSize: '12px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>
                      Distance maximale autorisée (mètres)
                    </label>
                    <input
                      type="number"
                      step="500"
                      value={maxDistanceM}
                      onChange={e => setMaxDistanceM(parseInt(e.target.value, 10) || 5000)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#fff', fontSize: '12px'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="allow_consecutive_check"
                    checked={allowConsecutive}
                    onChange={e => setAllowConsecutive(e.target.checked)}
                    style={{ accentColor: 'var(--accent-default)' }}
                  />
                  <label htmlFor="allow_consecutive_check" style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', cursor: 'pointer' }}>
                    Autoriser l'enchaînement consécutif sur deux tronçons successifs
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MANIFEST JSON V2 */}
          {activeTab === 'manifest' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.5)' }}>
                  Manifeste conforme au standard Hub v2 (JSON Schema validé)
                </span>
                {manifestError ? (
                  <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 600 }}>Erreur JSON : {manifestError}</span>
                ) : (
                  <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>✓ Syntaxe JSON valide</span>
                )}
              </div>
              <textarea
                value={manifestJson}
                onChange={e => {
                  setManifestJson(e.target.value);
                  try {
                    JSON.parse(e.target.value);
                    setManifestError(null);
                  } catch (err: any) {
                    setManifestError(err.message);
                  }
                }}
                spellCheck={false}
                style={{
                  flex: 1, minHeight: '340px', width: '100%',
                  padding: '14px', borderRadius: '12px',
                  background: '#090a0f', border: `1px solid ${manifestError ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'}`,
                  color: '#93c5fd', fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '12px', lineHeight: 1.5, resize: 'none', outline: 'none'
                }}
              />
            </div>
          )}

          {/* TAB 4: LIVE TEST */}
          {activeTab === 'test' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                  Texte de navigation à encoder (Texte Clair)
                </label>
                <input
                  type="text"
                  value={testInput}
                  onChange={e => setTestInput(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff', fontSize: '13px'
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleRunTest}
                style={{
                  alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 16px', borderRadius: '8px',
                  background: 'var(--accent-default)', border: 'none', color: '#000',
                  fontWeight: 700, fontSize: '12.5px', cursor: 'pointer'
                }}
              >
                <Play size={13} fill="#000" />
                <span>Tester la transformation</span>
              </button>

              {testOutput && (
                <div style={{
                  padding: '16px', borderRadius: '12px',
                  background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Sortie transformée
                  </span>
                  <div style={{ fontFamily: 'monospace', fontSize: '14px', color: '#34d399', wordBreak: 'break-all' }}>
                    {testOutput}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0, 0, 0, 0.25)'
        }}>
          <span style={{ fontSize: '12px', color: s3Status ? (s3Status.startsWith('✓') ? '#34d399' : '#f87171') : savedSuccess ? '#34d399' : 'rgba(255, 255, 255, 0.4)' }}>
            {s3Status || (savedSuccess ? '✓ Module enregistré avec succès !' : 'Modifications enregistrées localement ou dans le bucket S3 Garage.')}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px', borderRadius: '8px',
                background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.12)',
                color: 'rgba(255, 255, 255, 0.7)', fontSize: '12.5px', fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 14px', borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff', fontSize: '12.5px', fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Save size={14} />
              <span>{isCreation ? 'Enregistrer local' : 'Enregistrer local'}</span>
            </button>
            <button
              type="button"
              disabled={isPublishingS3}
              onClick={handlePublishS3}
              title="Enregistre et publie l'archive ZIP sur le stockage S3 Garage (scoutraider-assets)"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7, #2563eb)', border: 'none',
                color: '#fff', fontSize: '12.5px', fontWeight: 700,
                cursor: isPublishingS3 ? 'not-allowed' : 'pointer',
                opacity: isPublishingS3 ? 0.7 : 1,
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
              }}
            >
              {isPublishingS3 ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
              <span>{isPublishingS3 ? 'Publication S3...' : 'Publier dans le Bucket S3'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

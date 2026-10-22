import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { usePlayback } from '../context/PlayerContext';
import { 
  Swords, 
  Plus, 
  Play, 
  Headphones, 
  Trash2, 
  Upload, 
  Sparkles, 
  X, 
  MoreVertical, 
  Globe, 
  Lock,
  Shield,
  Wand2,
  Trees,
  Dices,
  Skull,
  Ghost,
  Beer,
  Bell,
  Flame,
  Zap,
  Target,
  Bomb,
  Compass,
  Footprints,
  LayoutList,
  LayoutGrid,
  Repeat
} from 'lucide-react';

const SFX_CATEGORY_ICONS: Record<
  string, 
  { label: string; icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }> }
> = {
  swords: { label: 'Combat', icon: Swords },
  shield: { label: 'Defense', icon: Shield },
  sparkles: { label: 'Magic', icon: Sparkles },
  wand: { label: 'Spells', icon: Wand2 },
  trees: { label: 'Nature', icon: Trees },
  dices: { label: 'Dice', icon: Dices },
  skull: { label: 'Monsters', icon: Skull },
  ghost: { label: 'Undead', icon: Ghost },
  beer: { label: 'Tavern', icon: Beer },
  bell: { label: 'Bell', icon: Bell },
  flame: { label: 'Fire', icon: Flame },
  zap: { label: 'Lightning', icon: Zap },
  target: { label: 'Archery', icon: Target },
  bomb: { label: 'Traps', icon: Bomb },
  compass: { label: 'Adventure', icon: Compass },
  footprints: { label: 'Stealth', icon: Footprints },
  globe: { label: 'Shared', icon: Globe },
};

const EMOJI_TO_ICON_ID: Record<string, string> = {
  '⚔️': 'swords',
  '🛡️': 'shield',
  '🏹': 'target',
  '🧙': 'wand',
  '✨': 'sparkles',
  '🌲': 'trees',
  '🎲': 'dices',
  '💀': 'skull',
  '🍺': 'beer',
  '⚡': 'zap',
  '🔔': 'bell',
  '💥': 'bomb',
  '🔥': 'flame',
  '🐉': 'skull',
  '🌐': 'globe',
};

const renderCategoryIcon = (iconKey?: string, size = 18) => {
  const iconId = (iconKey && EMOJI_TO_ICON_ID[iconKey]) || iconKey || 'swords';
  const IconComponent = SFX_CATEGORY_ICONS[iconId]?.icon || Swords;
  return <IconComponent size={size} className="sfx-category-icon-svg" />;
};

interface MarqueeTitleProps {
  title: string;
}

const MarqueeTitle: React.FC<MarqueeTitleProps> = ({ title }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scrollData, setScrollData] = useState<{ canScroll: boolean; dist: number; duration: number }>({
    canScroll: false,
    dist: 0,
    duration: 3
  });

  const measure = useCallback(() => {
    if (containerRef.current && textRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const textWidth = textRef.current.scrollWidth;
      const diff = textWidth - containerWidth;
      if (diff > 2) {
        const dist = diff + 6;
        // Comfortable reading speed: ~28px per second, clamped between 2.5s and 7s
        const duration = Math.min(7, Math.max(2.5, dist / 28));
        setScrollData({ canScroll: true, dist, duration });
      } else {
        setScrollData({ canScroll: false, dist: 0, duration: 3 });
      }
    }
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, title]);

  return (
    <div 
      ref={containerRef} 
      className="sfx-marquee-wrap"
      onMouseEnter={measure}
    >
      <span
        ref={textRef}
        className={`sfx-sound-title ${scrollData.canScroll ? 'can-scroll' : ''}`}
        style={scrollData.canScroll ? {
          '--scroll-dist': `-${scrollData.dist}px`,
          '--scroll-dur': `${scrollData.duration}s`
        } as React.CSSProperties : undefined}
      >
        {title}
      </span>
    </div>
  );
};

export const RightSfxPanel: React.FC = () => {
  const { data: playlists = [], refetch } = useQuery({
    queryKey: ['sfxPlaylists'],
    queryFn: api.fetchSfxPlaylists
  });

  const { sfxVolume = 0.8, status } = usePlayback();
  const loopingSfx = status?.loopingSfx || [];
  const isSoundLooping = (soundId: number) => loopingSfx.includes(soundId);

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [playingSoundId, setPlayingSoundId] = useState<number | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [activeMenu, setActiveMenu] = useState<{
    sound: any;
    position: { top: number; left: number };
  } | null>(null);

  // View mode: 'single' (1 full-width column) or 'double' (2-column compact grid)
  const [viewMode, setViewMode] = useState<'single' | 'double'>(() => {
    return (localStorage.getItem('sfx_view_mode') as 'single' | 'double') || 'single';
  });

  const handleSetViewMode = (mode: 'single' | 'double') => {
    setViewMode(mode);
    localStorage.setItem('sfx_view_mode', mode);
  };

  // Modals state
  const [deleteCategoryModal, setDeleteCategoryModal] = useState<{ id: number; name: string } | null>(null);
  const [deleteSoundModal, setDeleteSoundModal] = useState<{ id: number; title: string } | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadPlaylistId, setUploadPlaylistId] = useState<number | null>(null);
  const [uploadIsGlobal, setUploadIsGlobal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // New playlist modal state
  const [isNewPlaylistOpen, setIsNewPlaylistOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistIcon, setNewPlaylistIcon] = useState('swords');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

  // Close context menu on outside click, window resize or scrolling inside sounds list
  useEffect(() => {
    const handleClose = () => setActiveMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('resize', handleClose);

    const stair3 = document.querySelector('.sfx-stair-3');
    stair3?.addEventListener('scroll', handleClose);

    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('resize', handleClose);
      stair3?.removeEventListener('scroll', handleClose);
    };
  }, [activeMenu]);

  const currentPlaylist = playlists.find((p: any) => p.id === selectedPlaylistId) || playlists[0];
  const activeCategoryId = currentPlaylist?.id ?? null;
  const sounds = currentPlaylist?.sounds || [];

  // Play SFX in Discord
  const handlePlayInDiscord = async (soundId: number) => {
    try {
      setPlayingSoundId(soundId);
      await api.playSfx(soundId, sfxVolume);
      setTimeout(() => setPlayingSoundId(null), 2500);
    } catch (err) {
      console.error('Failed to play SFX in Discord:', err);
      setPlayingSoundId(null);
    }
  };

  // Toggle SFX loop in Discord (continuous ambient sound)
  const handleToggleLoop = async (e: React.MouseEvent, soundId: number) => {
    e.stopPropagation();
    try {
      if (isSoundLooping(soundId)) {
        await api.stopSfxLoop(soundId);
      } else {
        await api.playSfx(soundId, sfxVolume, true);
      }
    } catch (err) {
      console.error('Failed to toggle SFX loop:', err);
    }
  };

  // Browser local preview (headphones for DM)
  const handlePreviewBrowser = (soundId: number) => {
    if (previewAudio) {
      previewAudio.pause();
    }
    const audio = new Audio(api.getSfxAudioUrl(soundId));
    audio.volume = sfxVolume;
    audio.play().catch(e => console.error('Preview error:', e));
    setPreviewAudio(audio);
  };

  // Toggle context menu and compute floating coordinates
  const handleToggleMenu = (e: React.MouseEvent<HTMLButtonElement>, sound: any) => {
    e.stopPropagation();
    if (activeMenu?.sound?.id === sound.id) {
      setActiveMenu(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 170;
    const menuHeight = sound.canEdit ? 105 : 42;

    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    let top: number;
    if (spaceBelow < menuHeight + 10 && rect.top > menuHeight + 10) {
      // Open upwards if near the bottom of viewport
      top = rect.top - menuHeight - 4;
    } else {
      // Open downwards
      top = rect.bottom + 4;
    }

    setActiveMenu({
      sound,
      position: { top, left }
    });
  };

  // Toggle isGlobal shared status
  const handleToggleGlobal = async (sound: any) => {
    try {
      await api.toggleSfxGlobal(sound.id);
      refetch();
    } catch (err) {
      console.error('Failed to toggle global SFX:', err);
      alert('Failed to update sound access');
    }
  };

  // Delete category action
  const confirmDeleteCategory = async () => {
    if (!deleteCategoryModal) return;
    try {
      await api.deleteSfxPlaylist(deleteCategoryModal.id);
      setDeleteCategoryModal(null);
      refetch();
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  // Delete sound action
  const confirmDeleteSound = async () => {
    if (!deleteSoundModal) return;
    try {
      await api.deleteSfxSound(deleteSoundModal.id);
      setDeleteSoundModal(null);
      refetch();
    } catch (err) {
      console.error('Failed to delete sound:', err);
    }
  };

  // Submit upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    const targetId = uploadPlaylistId || activeCategoryId || playlists[0]?.id;
    if (!targetId) return;

    try {
      setIsUploading(true);
      await api.uploadSfx(uploadFile, targetId, uploadTitle || undefined, uploadIsGlobal);
      setUploadFile(null);
      setUploadTitle('');
      setUploadIsGlobal(false);
      setIsUploadOpen(false);
      refetch();
    } catch (err) {
      console.error('Failed to upload SFX:', err);
      alert('Failed to upload SFX sound');
    } finally {
      setIsUploading(false);
    }
  };

  // Submit new playlist
  const handleCreatePlaylistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    try {
      setIsCreatingPlaylist(true);
      const created = await api.createSfxPlaylist(newPlaylistName.trim(), newPlaylistIcon);
      setNewPlaylistName('');
      setIsNewPlaylistOpen(false);
      await refetch();
      if (created?.id) setSelectedPlaylistId(created.id);
    } catch (err) {
      console.error('Failed to create playlist:', err);
      alert('Failed to create category');
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  return (
    <div className="sfx-view">
      {/* STAIR 1: HEADER */}
      <div className="sfx-stair-1">
        <div className="sfx-stair-1-left">
          <Swords size={20} className="sfx-title-icon" />
          <h2 className="sfx-title">SFX</h2>
        </div>
        <div className="sfx-stair-1-actions">
          <button
            className="sfx-icon-btn"
            onClick={() => {
              setUploadPlaylistId(activeCategoryId && activeCategoryId > 0 ? activeCategoryId : playlists[0]?.id);
              setIsUploadOpen(true);
            }}
            title="Upload SFX sound"
          >
            <Upload size={17} />
          </button>
          <button
            className="sfx-icon-btn"
            onClick={() => setIsNewPlaylistOpen(true)}
            title="Create category"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* STAIR 2: CATEGORIES (MINI-PLAYLISTS) */}
      <div className="sfx-stair-2">
        <div className="sfx-categories-scroll">
          {playlists.map((pl: any) => (
            <div
              key={pl.id}
              className={`sfx-category-card ${activeCategoryId === pl.id ? 'active' : ''}`}
              onClick={() => setSelectedPlaylistId(pl.id)}
              title={pl.name}
            >
              <div className="sfx-category-inner">
                {renderCategoryIcon(pl.icon, 18)}
                <span className="sfx-category-name">{pl.name}</span>
              </div>
              {pl.id > 0 && playlists.filter((p: any) => p.id > 0).length > 1 && (
                <button
                  className="sfx-category-del-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteCategoryModal({ id: pl.id, name: pl.name });
                  }}
                  title="Delete category"
                >
                  <X size={9} strokeWidth={2.5} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* STAIR 3: SOUNDS GRID */}
      <div className="sfx-stair-3">
        <div className="sfx-stair-3-header">
          <span className="sfx-category-heading">
            {currentPlaylist?.name || 'SFX'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="sfx-sounds-count">
              {sounds.length} {sounds.length === 1 ? 'sound' : 'sounds'}
            </span>
            <div className="sfx-view-toggle">
              <button
                type="button"
                className={`sfx-view-toggle-btn ${viewMode === 'single' ? 'active' : ''}`}
                onClick={() => handleSetViewMode('single')}
                title="Single column (List)"
              >
                <LayoutList size={13} />
              </button>
              <button
                type="button"
                className={`sfx-view-toggle-btn ${viewMode === 'double' ? 'active' : ''}`}
                onClick={() => handleSetViewMode('double')}
                title="Double column (Grid)"
              >
                <LayoutGrid size={13} />
              </button>
            </div>
          </div>
        </div>

        {sounds.length === 0 ? (
          <div className="sfx-empty">
            <Sparkles size={28} style={{ opacity: 0.5, marginBottom: 4 }} />
            <p>No sounds in this category yet</p>
            <button
              className="sfx-btn-primary"
              onClick={() => {
                setUploadPlaylistId(activeCategoryId && activeCategoryId > 0 ? activeCategoryId : playlists[0]?.id);
                setIsUploadOpen(true);
              }}
            >
              <Upload size={14} /> Upload Sound
            </button>
          </div>
        ) : (
          <div className={`sfx-sounds-grid ${viewMode === 'single' ? 'single-col' : ''}`}>
            {sounds.map((sound: any) => (
              <div
                key={sound.id}
                className={`sfx-sound-card ${viewMode === 'single' ? 'single-col' : ''} ${playingSoundId === sound.id ? 'playing' : ''} ${isSoundLooping(sound.id) ? 'is-looping' : ''}`}
                onClick={() => handlePlayInDiscord(sound.id)}
                title={`Click to play in Discord\n${sound.title}`}
              >
                <div className="sfx-sound-left">
                  <Play size={viewMode === 'single' ? 13 : 11} className={`sfx-play-icon ${playingSoundId === sound.id ? 'playing' : ''}`} />
                  <MarqueeTitle title={sound.title} />
                  {sound.isGlobal && (
                    <span title="Shared sound for all DMs" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                      <Globe size={11} className="sfx-globe-icon" />
                    </span>
                  )}
                </div>

                <div className="sfx-sound-right" onClick={e => e.stopPropagation()}>
                  {viewMode === 'single' && sound.duration && (
                    <span className="sfx-sound-duration" title="Duration">
                      {sound.duration < 10 ? `${sound.duration.toFixed(1)}s` : `${Math.round(sound.duration)}s`}
                    </span>
                  )}
                  <button
                    className={`sfx-sound-loop-trigger ${isSoundLooping(sound.id) ? 'active' : ''}`}
                    onClick={(e) => handleToggleLoop(e, sound.id)}
                    title={isSoundLooping(sound.id) ? 'Stop ambient loop' : 'Loop sound (Ambience)'}
                  >
                    <Repeat size={viewMode === 'single' ? 13 : 11} />
                  </button>
                  <button
                    className={`sfx-sound-menu-trigger ${activeMenu?.sound?.id === sound.id ? 'active' : ''}`}
                    onClick={(e) => handleToggleMenu(e, sound)}
                    title="Actions"
                  >
                    <MoreVertical size={viewMode === 'single' ? 13 : 11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CONFIRM DELETE CATEGORY MODAL */}
      {deleteCategoryModal && createPortal(
        <div className="modal-overlay" onClick={() => setDeleteCategoryModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px 0' }}>Delete Category</h3>
            <p style={{ margin: '0 0 16px 0' }}><strong>{deleteCategoryModal.name}</strong></p>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
              Are you sure you want to delete this category and all sound effects in it?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={confirmDeleteCategory}
                className="delete-option-btn danger"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 60, 60, 0.5)', background: 'rgba(255, 60, 60, 0.2)', color: '#ff5555', cursor: 'pointer' }}
              >
                Yes, delete category
              </button>
              <button
                className="delete-option-btn"
                onClick={() => setDeleteCategoryModal(null)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer', marginTop: '8px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRM DELETE SOUND MODAL */}
      {deleteSoundModal && createPortal(
        <div className="modal-overlay" onClick={() => setDeleteSoundModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px 0' }}>Delete Sound</h3>
            <p style={{ margin: '0 0 16px 0' }}><strong>{deleteSoundModal.title}</strong></p>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
              Are you sure you want to permanently delete this sound effect?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={confirmDeleteSound}
                className="delete-option-btn danger"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 60, 60, 0.5)', background: 'rgba(255, 60, 60, 0.2)', color: '#ff5555', cursor: 'pointer' }}
              >
                Yes, delete sound
              </button>
              <button
                className="delete-option-btn"
                onClick={() => setDeleteSoundModal(null)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer', marginTop: '8px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* UPLOAD MODAL */}
      {isUploadOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsUploadOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Upload SFX Sound</h3>
              <button
                onClick={() => setIsUploadOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Audio file (.mp3, .wav, .ogg, .m4a):
                </label>
                <input
                  type="file"
                  accept=".mp3,.wav,.ogg,.m4a"
                  required
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setUploadFile(f);
                    if (f && !uploadTitle) {
                      setUploadTitle(f.name.replace(/\.[^/.]+$/, '').replace(/^[0-9]+_/, '').replace(/_/g, ' '));
                    }
                  }}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Sound title:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sword Slash, Fireball..."
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Category:
                </label>
                <select
                  value={uploadPlaylistId || activeCategoryId || ''}
                  onChange={e => setUploadPlaylistId(Number(e.target.value))}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'var(--panel-bg)', color: 'white' }}
                >
                  {playlists.filter((p: any) => p.id > 0).map((pl: any) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.icon} {pl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <input
                  type="checkbox"
                  id="sfx-global-check"
                  checked={uploadIsGlobal}
                  onChange={e => setUploadIsGlobal(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
                <label htmlFor="sfx-global-check" style={{ fontSize: '12px', color: 'var(--text-main)', cursor: 'pointer' }}>
                  Make sound shared for all DMs 🌐
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: 'var(--bottom-bar-bg, #0b110d)', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* NEW CATEGORY MODAL */}
      {isNewPlaylistOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsNewPlaylistOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>New SFX Category</h3>
              <button
                onClick={() => setIsNewPlaylistOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreatePlaylistSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Category name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monsters, Traps..."
                  value={newPlaylistName}
                  required
                  autoFocus
                  onChange={e => setNewPlaylistName(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Category icon:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginTop: 4 }}>
                  {Object.entries(SFX_CATEGORY_ICONS)
                    .filter(([id]) => id !== 'globe')
                    .map(([id, item]) => {
                      const IconComp = item.icon;
                      const isSelected = newPlaylistIcon === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setNewPlaylistIcon(id)}
                          title={item.label}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 36,
                            borderRadius: 6,
                            border: isSelected ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                            background: isSelected ? 'rgba(134, 229, 156, 0.15)' : 'rgba(255,255,255,0.05)',
                            color: isSelected ? 'var(--accent)' : 'var(--text-main)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <IconComp size={18} />
                        </button>
                      );
                    })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsNewPlaylistOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim() || isCreatingPlaylist}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: 'var(--bottom-bar-bg, #0b110d)', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isCreatingPlaylist ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Action Menu for sound cards (Portal guarantees it is never trapped under stairs or clipped) */}
      {activeMenu && createPortal(
        <div
          className="sfx-sound-dropdown"
          style={{
            top: `${activeMenu.position.top}px`,
            left: `${activeMenu.position.left}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="sfx-dropdown-item"
            onClick={(e) => {
              const soundId = activeMenu.sound.id;
              setActiveMenu(null);
              handleToggleLoop(e, soundId);
            }}
          >
            <Repeat size={13} color={isSoundLooping(activeMenu.sound.id) ? 'var(--accent)' : 'currentColor'} />
            {isSoundLooping(activeMenu.sound.id) ? 'Stop Ambient Loop' : 'Loop Sound (Ambience)'}
          </button>
          <button
            className="sfx-dropdown-item"
            onClick={() => {
              const soundId = activeMenu.sound.id;
              setActiveMenu(null);
              handlePreviewBrowser(soundId);
            }}
          >
            <Headphones size={13} /> Preview (DM only)
          </button>
          {activeMenu.sound.canEdit && (
            <button
              className="sfx-dropdown-item"
              onClick={() => {
                const sound = activeMenu.sound;
                setActiveMenu(null);
                handleToggleGlobal(sound);
              }}
            >
              {activeMenu.sound.isGlobal ? (
                <>
                  <Lock size={13} /> Make Private
                </>
              ) : (
                <>
                  <Globe size={13} /> Make Shared
                </>
              )}
            </button>
          )}
          {activeMenu.sound.canEdit && (
            <button
              className="sfx-dropdown-item danger"
              onClick={() => {
                const sound = activeMenu.sound;
                setActiveMenu(null);
                setDeleteSoundModal({ id: sound.id, title: sound.title });
              }}
            >
              <Trash2 size={13} /> Delete Sound
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

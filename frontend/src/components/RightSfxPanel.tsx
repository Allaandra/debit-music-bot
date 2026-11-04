import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { usePlayback } from '../context/PlayerContext';
import { 
  Swords, 
  Plus, 
  Play, 
  Upload, 
  Sparkles, 
  X, 
  MoreVertical, 
  Globe, 
  LayoutList,
  LayoutGrid,
  Repeat
} from 'lucide-react';
import {
  renderCategoryIcon,
  MarqueeTitle
} from './sfx/SfxCategoryIcons';
import { SfxModals } from './sfx/SfxModals';

export {
  SFX_CATEGORY_ICONS,
  CATEGORY_ICON_OPTIONS,
  EMOJI_TO_ICON_ID,
  renderCategoryIcon,
  MarqueeTitle,
  type MarqueeTitleProps
} from './sfx/SfxCategoryIcons';

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
                    <MoreVertical size={viewMode === 'single' ? 14 : 13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SfxModals
        deleteCategoryModal={deleteCategoryModal}
        setDeleteCategoryModal={setDeleteCategoryModal}
        confirmDeleteCategory={confirmDeleteCategory}
        deleteSoundModal={deleteSoundModal}
        setDeleteSoundModal={setDeleteSoundModal}
        confirmDeleteSound={confirmDeleteSound}
        isUploadOpen={isUploadOpen}
        setIsUploadOpen={setIsUploadOpen}
        handleUploadSubmit={handleUploadSubmit}
        uploadFile={uploadFile}
        setUploadFile={setUploadFile}
        uploadTitle={uploadTitle}
        setUploadTitle={setUploadTitle}
        uploadPlaylistId={uploadPlaylistId}
        setUploadPlaylistId={setUploadPlaylistId}
        activeCategoryId={activeCategoryId}
        playlists={playlists}
        uploadIsGlobal={uploadIsGlobal}
        setUploadIsGlobal={setUploadIsGlobal}
        isUploading={isUploading}
        isNewPlaylistOpen={isNewPlaylistOpen}
        setIsNewPlaylistOpen={setIsNewPlaylistOpen}
        handleCreatePlaylistSubmit={handleCreatePlaylistSubmit}
        newPlaylistName={newPlaylistName}
        setNewPlaylistName={setNewPlaylistName}
        newPlaylistIcon={newPlaylistIcon}
        setNewPlaylistIcon={setNewPlaylistIcon}
        isCreatingPlaylist={isCreatingPlaylist}
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        isSoundLooping={isSoundLooping}
        handleToggleLoop={handleToggleLoop}
        handlePreviewBrowser={handlePreviewBrowser}
        handleToggleGlobal={handleToggleGlobal}
      />
    </div>
  );
};

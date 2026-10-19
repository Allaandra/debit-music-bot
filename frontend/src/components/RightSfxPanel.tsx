import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { Swords, Plus, Play, Headphones, Trash2, Upload, Sparkles, X, MoreVertical, Globe, Lock } from 'lucide-react';

export const RightSfxPanel: React.FC = () => {
  const { data: playlists = [], refetch } = useQuery({
    queryKey: ['sfxPlaylists'],
    queryFn: api.fetchSfxPlaylists
  });

  const { sfxVolume = 0.8 } = usePlayer();

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [playingSoundId, setPlayingSoundId] = useState<number | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [activeMenu, setActiveMenu] = useState<{
    sound: any;
    position: { top: number; left: number };
  } | null>(null);

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
  const [newPlaylistIcon, setNewPlaylistIcon] = useState('⚔️');
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

  // Auto-select first playlist when loaded
  useEffect(() => {
    if (playlists.length > 0) {
      if (!selectedPlaylistId || !playlists.some((p: any) => p.id === selectedPlaylistId)) {
        setSelectedPlaylistId(playlists[0].id);
      }
    }
  }, [playlists, selectedPlaylistId]);

  const currentPlaylist = playlists.find((p: any) => p.id === selectedPlaylistId) || playlists[0];
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
      alert('Ошибка при изменении доступа к звуку');
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
    const targetId = uploadPlaylistId || selectedPlaylistId || playlists[0]?.id;
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
      alert('Ошибка при загрузке звука');
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
      alert('Ошибка при создании категории');
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  const emojiIcons = ['⚔️', '🛡️', '🏹', '🧙', '💀', '🎲', '🍺', '🌲', '⚡', '🔔', '💥', '🐉'];

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
              setUploadPlaylistId(selectedPlaylistId && selectedPlaylistId > 0 ? selectedPlaylistId : playlists[0]?.id);
              setIsUploadOpen(true);
            }}
            title="Загрузить SFX звук"
          >
            <Upload size={17} />
          </button>
          <button
            className="sfx-icon-btn"
            onClick={() => setIsNewPlaylistOpen(true)}
            title="Создать категорию"
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
              className={`sfx-category-card ${selectedPlaylistId === pl.id ? 'active' : ''}`}
              onClick={() => setSelectedPlaylistId(pl.id)}
              title={pl.name}
            >
              <div className="sfx-category-inner">
                <span className="sfx-category-emoji">{pl.icon || '⚔️'}</span>
                <span className="sfx-category-name">{pl.name}</span>
              </div>
              {pl.id > 0 && playlists.filter((p: any) => p.id > 0).length > 1 && (
                <button
                  className="sfx-category-del-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteCategoryModal({ id: pl.id, name: pl.name });
                  }}
                  title="Удалить категорию"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
          {playlists.filter((p: any) => p.id > 0).length < 8 && (
            <button
              className="sfx-category-card sfx-category-add"
              onClick={() => setIsNewPlaylistOpen(true)}
              title="Добавить категорию"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
      </div>

      {/* STAIR 3: SOUNDS GRID */}
      <div className="sfx-stair-3">
        <div className="sfx-stair-3-header">
          <span className="sfx-category-heading">
            {currentPlaylist?.name || 'SFX'}
          </span>
          <span className="sfx-sounds-count">
            {sounds.length} {sounds.length === 1 ? 'звук' : sounds.length >= 2 && sounds.length <= 4 ? 'звука' : 'звуков'}
          </span>
        </div>

        {sounds.length === 0 ? (
          <div className="sfx-empty">
            <Sparkles size={28} style={{ opacity: 0.5, marginBottom: 4 }} />
            <p>В этой категории пока нет звуков</p>
            <button
              className="sfx-btn-primary"
              onClick={() => {
                setUploadPlaylistId(selectedPlaylistId && selectedPlaylistId > 0 ? selectedPlaylistId : playlists[0]?.id);
                setIsUploadOpen(true);
              }}
            >
              <Upload size={14} /> Загрузить звук
            </button>
          </div>
        ) : (
          <div className="sfx-sounds-grid">
            {sounds.map((sound: any) => (
              <div
                key={sound.id}
                className={`sfx-sound-card ${playingSoundId === sound.id ? 'playing' : ''}`}
                onClick={() => handlePlayInDiscord(sound.id)}
                title={`Клик: сыграть в Discord\n${sound.title}`}
              >
                <div className="sfx-sound-left">
                  <Play size={11} className={`sfx-play-icon ${playingSoundId === sound.id ? 'playing' : ''}`} />
                  <span className="sfx-sound-title">{sound.title}</span>
                  {sound.isGlobal && (
                    <span title="Общий звук для всех Мастеров" style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <Globe size={10} className="sfx-globe-icon" />
                    </span>
                  )}
                </div>

                <div className="sfx-sound-right" onClick={e => e.stopPropagation()}>
                  <button
                    className={`sfx-sound-menu-trigger ${activeMenu?.sound?.id === sound.id ? 'active' : ''}`}
                    onClick={(e) => handleToggleMenu(e, sound)}
                    title="Действия"
                  >
                    <MoreVertical size={11} />
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
            <h3 style={{ margin: '0 0 8px 0' }}>Удалить категорию</h3>
            <p style={{ margin: '0 0 16px 0' }}><strong>{deleteCategoryModal.name}</strong></p>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
              Вы уверены, что хотите удалить эту категорию и все звуковые эффекты в ней?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={confirmDeleteCategory}
                className="delete-option-btn danger"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 60, 60, 0.5)', background: 'rgba(255, 60, 60, 0.2)', color: '#ff5555', cursor: 'pointer' }}
              >
                Да, удалить категорию
              </button>
              <button
                className="delete-option-btn"
                onClick={() => setDeleteCategoryModal(null)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer', marginTop: '8px' }}
              >
                Отмена
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
            <h3 style={{ margin: '0 0 8px 0' }}>Удалить звук</h3>
            <p style={{ margin: '0 0 16px 0' }}><strong>{deleteSoundModal.title}</strong></p>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
              Вы уверены, что хотите навсегда удалить этот звуковой эффект?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={confirmDeleteSound}
                className="delete-option-btn danger"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 60, 60, 0.5)', background: 'rgba(255, 60, 60, 0.2)', color: '#ff5555', cursor: 'pointer' }}
              >
                Да, удалить звук
              </button>
              <button
                className="delete-option-btn"
                onClick={() => setDeleteSoundModal(null)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer', marginTop: '8px' }}
              >
                Отмена
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
              <h3 style={{ margin: 0 }}>Загрузить SFX звук</h3>
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
                  Аудиофайл (.mp3, .wav, .ogg):
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
                  Название звука:
                </label>
                <input
                  type="text"
                  placeholder="Например: Удар меча, Фаербол..."
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Категория:
                </label>
                <select
                  value={uploadPlaylistId || selectedPlaylistId || ''}
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
                  Сделать звук общим для всех Мастеров 🌐
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer' }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: 'var(--bottom-bar-bg, #0b110d)', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isUploading ? 'Загрузка...' : 'Загрузить'}
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
              <h3 style={{ margin: 0 }}>Новая категория SFX</h3>
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
                  Название категории:
                </label>
                <input
                  type="text"
                  placeholder="Например: Монстры, Ловушки..."
                  value={newPlaylistName}
                  required
                  autoFocus
                  onChange={e => setNewPlaylistName(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Иконка / Эмодзи:
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {emojiIcons.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewPlaylistIcon(icon)}
                      style={{
                        fontSize: 18,
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: newPlaylistIcon === icon ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                        background: newPlaylistIcon === icon ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.05)',
                        cursor: 'pointer'
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsNewPlaylistOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer' }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim() || isCreatingPlaylist}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: 'var(--bottom-bar-bg, #0b110d)', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isCreatingPlaylist ? 'Создание...' : 'Создать'}
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
            onClick={() => {
              const soundId = activeMenu.sound.id;
              setActiveMenu(null);
              handlePreviewBrowser(soundId);
            }}
          >
            <Headphones size={13} /> В наушниках (DM)
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
                  <Lock size={13} /> Сделать личным
                </>
              ) : (
                <>
                  <Globe size={13} /> Сделать общим
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
              <Trash2 size={13} /> Удалить звук
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

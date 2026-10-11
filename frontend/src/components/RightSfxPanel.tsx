import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Swords, Plus, Play, Headphones, Trash2, Upload, Sparkles, X, MoreVertical, Globe, Lock } from 'lucide-react';

export const RightSfxPanel: React.FC = () => {
  const { data: playlists = [], refetch } = useQuery({
    queryKey: ['sfxPlaylists'],
    queryFn: api.fetchSfxPlaylists
  });

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [playingSoundId, setPlayingSoundId] = useState<number | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [activeMenuSoundId, setActiveMenuSoundId] = useState<number | null>(null);

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

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuSoundId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

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
      await api.playSfx(soundId);
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
    audio.volume = 0.7;
    audio.play().catch(e => console.error('Preview error:', e));
    setPreviewAudio(audio);
  };

  // Toggle isGlobal shared status
  const handleToggleGlobal = async (sound: any) => {
    const question = sound.isGlobal
      ? `Сделать звук «${sound.title}» личным? (Другие Мастера больше не будут его видеть)`
      : `Вы хотите сделать этот звук «${sound.title}» общим для всех? (Его смогут использовать все Мастера)`;

    if (!window.confirm(question)) return;

    try {
      await api.toggleSfxGlobal(sound.id);
      refetch();
    } catch (err) {
      console.error('Failed to toggle global SFX:', err);
      alert('Ошибка при изменении доступа к звуку');
    }
  };

  // Delete sound
  const handleDeleteSound = async (soundId: number, title: string) => {
    if (!window.confirm(`Удалить звук «${title}»?`)) return;
    try {
      await api.deleteSfxSound(soundId);
      refetch();
    } catch (err) {
      console.error('Failed to delete SFX:', err);
    }
  };

  // Delete playlist
  const handleDeletePlaylist = async (playlistId: number, name: string) => {
    if (!window.confirm(`Удалить категорию «${name}» и все её звуки?`)) return;
    try {
      await api.deleteSfxPlaylist(playlistId);
      refetch();
    } catch (err) {
      console.error('Failed to delete playlist:', err);
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
      alert('Ошибка при создании плейлиста');
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  const emojiIcons = ['⚔️', '🛡️', '🏹', '🧙', '💀', '🎲', '🍺', '🌲', '⚡', '🔔', '💥', '🐉'];

  return (
    <div className="sfx-panel-view">
      {/* Header */}
      <div className="sfx-header">
        <div className="sfx-title-wrap">
          <Swords size={18} className="sfx-icon-title" />
          <h3 className="sfx-title">Звуковые эффекты</h3>
        </div>
        <div className="sfx-header-actions">
          <button
            className="sfx-btn-primary"
            onClick={() => {
              setUploadPlaylistId(selectedPlaylistId && selectedPlaylistId > 0 ? selectedPlaylistId : playlists[0]?.id);
              setIsUploadOpen(true);
            }}
            title="Загрузить аудиофайл"
          >
            <Upload size={13} />
            <span>Звук</span>
          </button>
          <button
            className="sfx-btn-secondary"
            onClick={() => setIsNewPlaylistOpen(true)}
            title="Создать мини-плейлист"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Mini-playlists row (3-6 squares) */}
      <div className="sfx-playlists-container">
        <div className="sfx-playlists-grid">
          {playlists.map((pl: any) => (
            <button
              key={pl.id}
              className={`sfx-playlist-square ${selectedPlaylistId === pl.id ? 'active' : ''}`}
              onClick={() => setSelectedPlaylistId(pl.id)}
              title={pl.name}
            >
              <span className="sfx-square-icon">{pl.icon || '⚔️'}</span>
              <span className="sfx-square-name">{pl.name}</span>
              <span className="sfx-square-count">{pl.sounds?.length || 0}</span>
              {pl.id > 0 && playlists.filter((p: any) => p.id > 0).length > 1 && (
                <span
                  className="sfx-square-del"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePlaylist(pl.id, pl.name);
                  }}
                  title="Удалить категорию"
                >
                  ×
                </span>
              )}
            </button>
          ))}
          {playlists.filter((p: any) => p.id > 0).length < 6 && (
            <button
              className="sfx-playlist-square sfx-square-add"
              onClick={() => setIsNewPlaylistOpen(true)}
              title="Добавить категорию"
            >
              <Plus size={18} />
              <span className="sfx-square-name">Новый</span>
            </button>
          )}
        </div>
      </div>

      {/* Current Category Bar */}
      <div className="sfx-current-bar">
        <span className="sfx-current-name">
          {currentPlaylist?.icon} {currentPlaylist?.name || 'SFX'}
        </span>
        <span className="sfx-current-count">
          {sounds.length} {sounds.length === 1 ? 'звук' : sounds.length >= 2 && sounds.length <= 4 ? 'звука' : 'звуков'}
        </span>
      </div>

      {/* Sounds Grid in 2 Columns */}
      <div className="sfx-sounds-grid-wrapper">
        {sounds.length === 0 ? (
          <div className="sfx-empty">
            <Sparkles size={24} style={{ opacity: 0.5, marginBottom: 4 }} />
            <p>В этой категории пока нет звуков</p>
            <button
              className="sfx-btn-primary"
              onClick={() => {
                setUploadPlaylistId(selectedPlaylistId && selectedPlaylistId > 0 ? selectedPlaylistId : playlists[0]?.id);
                setIsUploadOpen(true);
              }}
            >
              <Upload size={13} /> Загрузить звук
            </button>
          </div>
        ) : (
          <div className="sfx-sounds-2col-grid">
            {sounds.map((sound: any) => (
              <div
                key={sound.id}
                className={`sfx-sound-card ${playingSoundId === sound.id ? 'playing' : ''}`}
                onClick={() => handlePlayInDiscord(sound.id)}
                title={`Клик: сыграть в Discord поверх музыки\n${sound.title}`}
              >
                <div className="sfx-sound-main">
                  <Play size={12} className="sfx-play-icon" />
                  <span className="sfx-sound-title">{sound.title}</span>
                  {sound.isGlobal && (
                    <span title="Общий звук для всех Мастеров" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 3 }}>
                      <Globe size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    </span>
                  )}
                </div>

                <div className="sfx-sound-actions">
                  <button
                    className="sfx-sound-mini-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewBrowser(sound.id);
                    }}
                    title="Превью в наушниках (только для вас)"
                  >
                    <Headphones size={12} />
                  </button>

                  <button
                    className="sfx-sound-mini-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuSoundId(activeMenuSoundId === sound.id ? null : sound.id);
                    }}
                    title="Действия со звуком"
                  >
                    <MoreVertical size={12} />
                  </button>

                  {/* Context menu for sound */}
                  {activeMenuSoundId === sound.id && (
                    <div className="sfx-sound-dropdown" onClick={(e) => e.stopPropagation()}>
                      {sound.canEdit && (
                        <button
                          className="sfx-dropdown-item"
                          onClick={() => {
                            setActiveMenuSoundId(null);
                            handleToggleGlobal(sound);
                          }}
                        >
                          {sound.isGlobal ? (
                            <>
                              <Lock size={12} /> Сделать личным
                            </>
                          ) : (
                            <>
                              <Globe size={12} /> Сделать общим для всех
                            </>
                          )}
                        </button>
                      )}
                      {sound.canEdit && (
                        <button
                          className="sfx-dropdown-item danger"
                          onClick={() => {
                            setActiveMenuSoundId(null);
                            handleDeleteSound(sound.id, sound.title);
                          }}
                        >
                          <Trash2 size={12} /> Удалить звук
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="sfx-modal-backdrop" onClick={() => setIsUploadOpen(false)}>
          <div className="sfx-modal-card" onClick={e => e.stopPropagation()}>
            <div className="sfx-modal-header">
              <h4 className="sfx-modal-title">Загрузить SFX звук</h4>
              <button className="sfx-modal-close" onClick={() => setIsUploadOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="sfx-modal-field">
                <label className="sfx-modal-label">Аудиофайл (.mp3, .wav, .ogg):</label>
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
                  className="sfx-modal-input"
                />
              </div>

              <div className="sfx-modal-field">
                <label className="sfx-modal-label">Название звука:</label>
                <input
                  type="text"
                  placeholder="Например: Удар меча, Фаербол..."
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  className="sfx-modal-input"
                />
              </div>

              <div className="sfx-modal-field">
                <label className="sfx-modal-label">Мини-плейлист:</label>
                <select
                  value={uploadPlaylistId || selectedPlaylistId || ''}
                  onChange={e => setUploadPlaylistId(Number(e.target.value))}
                  className="sfx-modal-select"
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
                  Сделать звук общим (будет доступен всем Мастерам) 🌐
                </label>
              </div>

              <div className="sfx-modal-actions">
                <button
                  type="button"
                  className="sfx-btn-secondary"
                  onClick={() => setIsUploadOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="sfx-btn-primary"
                  disabled={!uploadFile || isUploading}
                >
                  {isUploading ? 'Загрузка...' : 'Загрузить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Playlist Modal */}
      {isNewPlaylistOpen && (
        <div className="sfx-modal-backdrop" onClick={() => setIsNewPlaylistOpen(false)}>
          <div className="sfx-modal-card" onClick={e => e.stopPropagation()}>
            <div className="sfx-modal-header">
              <h4 className="sfx-modal-title">Новая категория SFX</h4>
              <button className="sfx-modal-close" onClick={() => setIsNewPlaylistOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreatePlaylistSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="sfx-modal-field">
                <label className="sfx-modal-label">Название категории:</label>
                <input
                  type="text"
                  placeholder="Например: Монстры, Ловушки..."
                  value={newPlaylistName}
                  required
                  onChange={e => setNewPlaylistName(e.target.value)}
                  className="sfx-modal-input"
                />
              </div>

              <div className="sfx-modal-field">
                <label className="sfx-modal-label">Иконка / Эмодзи:</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {emojiIcons.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewPlaylistIcon(icon)}
                      style={{
                        fontSize: 18,
                        padding: '4px 8px',
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

              <div className="sfx-modal-actions">
                <button
                  type="button"
                  className="sfx-btn-secondary"
                  onClick={() => setIsNewPlaylistOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="sfx-btn-primary"
                  disabled={!newPlaylistName.trim() || isCreatingPlaylist}
                >
                  {isCreatingPlaylist ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

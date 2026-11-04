import React from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Repeat,
  Headphones,
  Lock,
  Globe,
  Trash2
} from 'lucide-react';
import { SFX_CATEGORY_ICONS } from './SfxCategoryIcons';

export interface SfxModalsProps {
  deleteCategoryModal: { id: number; name: string } | null;
  setDeleteCategoryModal: React.Dispatch<React.SetStateAction<{ id: number; name: string } | null>>;
  confirmDeleteCategory: () => void;

  deleteSoundModal: { id: number; title: string } | null;
  setDeleteSoundModal: React.Dispatch<React.SetStateAction<{ id: number; title: string } | null>>;
  confirmDeleteSound: () => void;

  isUploadOpen: boolean;
  setIsUploadOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleUploadSubmit: (e: React.FormEvent) => void;
  uploadFile: File | null;
  setUploadFile: React.Dispatch<React.SetStateAction<File | null>>;
  uploadTitle: string;
  setUploadTitle: React.Dispatch<React.SetStateAction<string>>;
  uploadPlaylistId: number | null;
  setUploadPlaylistId: React.Dispatch<React.SetStateAction<number | null>>;
  activeCategoryId: number | null;
  playlists: any[];
  uploadIsGlobal: boolean;
  setUploadIsGlobal: React.Dispatch<React.SetStateAction<boolean>>;
  isUploading: boolean;

  isNewPlaylistOpen: boolean;
  setIsNewPlaylistOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleCreatePlaylistSubmit: (e: React.FormEvent) => void;
  newPlaylistName: string;
  setNewPlaylistName: React.Dispatch<React.SetStateAction<string>>;
  newPlaylistIcon: string;
  setNewPlaylistIcon: React.Dispatch<React.SetStateAction<string>>;
  isCreatingPlaylist: boolean;

  activeMenu: {
    sound: any;
    position: { top: number; left: number };
  } | null;
  setActiveMenu: React.Dispatch<
    React.SetStateAction<{
      sound: any;
      position: { top: number; left: number };
    } | null>
  >;
  isSoundLooping: (soundId: number) => boolean;
  handleToggleLoop: (e: React.MouseEvent, soundId: number) => void;
  handlePreviewBrowser: (soundId: number) => void;
  handleToggleGlobal: (sound: any) => void;
}

export const SfxModals: React.FC<SfxModalsProps> = ({
  deleteCategoryModal,
  setDeleteCategoryModal,
  confirmDeleteCategory,
  deleteSoundModal,
  setDeleteSoundModal,
  confirmDeleteSound,
  isUploadOpen,
  setIsUploadOpen,
  handleUploadSubmit,
  uploadFile,
  setUploadFile,
  uploadTitle,
  setUploadTitle,
  uploadPlaylistId,
  setUploadPlaylistId,
  activeCategoryId,
  playlists,
  uploadIsGlobal,
  setUploadIsGlobal,
  isUploading,
  isNewPlaylistOpen,
  setIsNewPlaylistOpen,
  handleCreatePlaylistSubmit,
  newPlaylistName,
  setNewPlaylistName,
  newPlaylistIcon,
  setNewPlaylistIcon,
  isCreatingPlaylist,
  activeMenu,
  setActiveMenu,
  isSoundLooping,
  handleToggleLoop,
  handlePreviewBrowser,
  handleToggleGlobal
}) => {
  return (
    <>
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
            left: `${activeMenu.position.left}px`,
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid var(--border-light)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
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
    </>
  );
};

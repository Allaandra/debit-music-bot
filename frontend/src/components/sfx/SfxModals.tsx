import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
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
  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isUploading && !isCreatingPlaylist) {
          setDeleteCategoryModal(null);
          setDeleteSoundModal(null);
          setIsUploadOpen(false);
          setIsNewPlaylistOpen(false);
          setActiveMenu(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUploading, isCreatingPlaylist, setDeleteCategoryModal, setDeleteSoundModal, setIsUploadOpen, setIsNewPlaylistOpen, setActiveMenu]);

  return (
    <>
      {/* 1. CONFIRM DELETE SFX CATEGORY MODAL */}
      {deleteCategoryModal && createPortal(
        <div className="modal-overlay" onClick={() => setDeleteCategoryModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Delete Category</h3>
            <p className="modal-target-badge">{deleteCategoryModal.name}</p>
            <p className="modal-description">
              Are you sure you want to delete this category and all sound effects in it?
            </p>
            <div className="modal-actions-stack">
              <button
                type="button"
                onClick={confirmDeleteCategory}
                className="modal-btn-danger"
              >
                Yes, Delete Category
              </button>
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={() => setDeleteCategoryModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 2. CONFIRM DELETE SFX SOUND MODAL */}
      {deleteSoundModal && createPortal(
        <div className="modal-overlay" onClick={() => setDeleteSoundModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Delete Sound</h3>
            <p className="modal-target-badge">{deleteSoundModal.title}</p>
            <p className="modal-description">
              Are you sure you want to permanently delete this sound effect?
            </p>
            <div className="modal-actions-stack">
              <button
                type="button"
                onClick={confirmDeleteSound}
                className="modal-btn-danger"
              >
                Yes, Delete Sound
              </button>
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={() => setDeleteSoundModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 3. UPLOAD SFX MODAL */}
      {isUploadOpen && createPortal(
        <div className="modal-overlay" onClick={() => !isUploading && setIsUploadOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Upload SFX Sound</h3>
            <p className="modal-description">
              Add a new sound effect or ambient loop to your DM soundboard:
            </p>
            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="modal-form-group">
                <label className="modal-label" htmlFor="sfx-file-input">
                  Audio file (.mp3, .wav, .ogg, .m4a):
                </label>
                <input
                  id="sfx-file-input"
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
                  className="modal-input-field"
                  style={{ padding: '8px 12px' }}
                />
              </div>

              <div className="modal-form-group">
                <label className="modal-label" htmlFor="sfx-title-input">
                  Sound title:
                </label>
                <input
                  id="sfx-title-input"
                  type="text"
                  required
                  placeholder="e.g. Sword Slash, Fireball, Tavern Bell..."
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  className="modal-input-field"
                />
              </div>

              <div className="modal-form-group">
                <label className="modal-label" htmlFor="sfx-category-select">
                  Category:
                </label>
                <select
                  id="sfx-category-select"
                  value={uploadPlaylistId || activeCategoryId || ''}
                  onChange={e => setUploadPlaylistId(Number(e.target.value))}
                  className="modal-input-field"
                  style={{ background: 'var(--panel-bg, #1a221b)', cursor: 'pointer' }}
                >
                  {playlists.filter((p: any) => p.id > 0).map((pl: any) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.icon} {pl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                <input
                  type="checkbox"
                  id="sfx-global-check"
                  checked={uploadIsGlobal}
                  onChange={e => setUploadIsGlobal(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent, #86e59c)', width: '16px', height: '16px' }}
                />
                <label htmlFor="sfx-global-check" style={{ fontSize: '12.5px', color: 'var(--text-main)', cursor: 'pointer' }}>
                  Make sound shared for all DMs 🌐
                </label>
              </div>

              <div className="modal-actions-stack">
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="modal-btn-primary"
                >
                  {isUploading ? 'Uploading...' : 'Upload Sound'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={isUploading}
                  className="modal-btn-cancel"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 4. NEW SFX CATEGORY MODAL */}
      {isNewPlaylistOpen && createPortal(
        <div className="modal-overlay" onClick={() => !isCreatingPlaylist && setIsNewPlaylistOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">New SFX Category</h3>
            <p className="modal-description">
              Create a custom category to group your battle, spell, or ambient sounds:
            </p>
            <form onSubmit={handleCreatePlaylistSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="modal-form-group">
                <label className="modal-label" htmlFor="new-sfx-cat-name">
                  Category name:
                </label>
                <input
                  id="new-sfx-cat-name"
                  type="text"
                  placeholder="e.g. Monsters, Traps, Weather..."
                  value={newPlaylistName}
                  required
                  autoFocus
                  onChange={e => setNewPlaylistName(e.target.value)}
                  className="modal-input-field"
                />
              </div>

              <div className="modal-form-group">
                <label className="modal-label">Category icon:</label>
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

              <div className="modal-actions-stack">
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim() || isCreatingPlaylist}
                  className="modal-btn-primary"
                >
                  {isCreatingPlaylist ? 'Creating...' : 'Create Category'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewPlaylistOpen(false)}
                  disabled={isCreatingPlaylist}
                  className="modal-btn-cancel"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 5. FLOATING ACTION MENU POPOVER FOR SOUND CARDS */}
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

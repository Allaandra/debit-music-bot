import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePlayer } from '../context/PlayerContext';

export const Modals: React.FC = () => {
  const {
    editPlaylistModal,
    setEditPlaylistModal,
    deletePlaylistModal,
    setDeletePlaylistModal,
    editPlaylist,
    deletePlaylist,
    isModalOpen,
    setIsModalOpen,
    newPlaylistName,
    setNewPlaylistName,
    importPlaylistModal,
    setImportPlaylistModal,
    importing,
    deleteTrackModal,
    setDeleteTrackModal,
    handleImportPlaylist,
    deleteTrackCompletely,
    deleteTrackFromPlaylist,
    handleCreatePlaylist
  } = usePlayer();

  // In-modal safety confirmation steps (replaces native window.confirm)
  const [confirmDeleteTrackCompletely, setConfirmDeleteTrackCompletely] = useState(false);
  const [confirmDeletePlaylistWithTracks, setConfirmDeletePlaylistWithTracks] = useState(false);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!importing) {
          setIsModalOpen(false);
          setDeleteTrackModal(null);
          setImportPlaylistModal(null);
          setEditPlaylistModal(null);
          setDeletePlaylistModal(null);
          setConfirmDeleteTrackCompletely(false);
          setConfirmDeletePlaylistWithTracks(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [importing, setIsModalOpen, setDeleteTrackModal, setImportPlaylistModal, setEditPlaylistModal, setDeletePlaylistModal]);

  return (
    <>
      {/* 1. NEW PLAYLIST MODAL */}
      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">New Playlist</h3>
            <p className="modal-description">
              Create a custom playlist to organize music for your TTRPG campaign:
            </p>
            <form onSubmit={handleCreatePlaylist} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="modal-form-group">
                <label className="modal-label" htmlFor="newPlaylistName">Playlist name:</label>
                <input
                  id="newPlaylistName"
                  name="newPlaylistName"
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Tavern Ambience, Boss Fight..."
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="modal-input-field"
                />
              </div>
              <div className="modal-actions-stack">
                <button type="submit" className="modal-btn-primary" disabled={!newPlaylistName.trim()}>
                  Create Playlist
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="modal-btn-cancel">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 2. REMOVE TRACK MODAL */}
      {deleteTrackModal && createPortal(
        <div
          className="modal-overlay"
          onClick={() => {
            setDeleteTrackModal(null);
            setConfirmDeleteTrackCompletely(false);
          }}
        >
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Remove Track</h3>
            <p className="modal-target-badge">{deleteTrackModal.title || deleteTrackModal.query}</p>

            {!confirmDeleteTrackCompletely ? (
              <>
                <p className="modal-description">
                  Do you want to remove this track from the current playlist, or delete it completely from your library?
                </p>
                <div className="modal-actions-stack">
                  <button
                    type="button"
                    className="modal-btn-secondary"
                    onClick={() => {
                      deleteTrackFromPlaylist(deleteTrackModal);
                      setConfirmDeleteTrackCompletely(false);
                    }}
                  >
                    Remove from Playlist Only
                  </button>
                  <button
                    type="button"
                    className="modal-btn-danger"
                    onClick={() => setConfirmDeleteTrackCompletely(true)}
                  >
                    Delete Completely from Library
                  </button>
                  <button
                    type="button"
                    className="modal-btn-cancel"
                    onClick={() => setDeleteTrackModal(null)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="modal-description modal-warning-text">
                  {deleteTrackModal.type === 'local'
                    ? '⚠️ Warning: This local audio file will be permanently deleted from your disk. This action cannot be undone!'
                    : '⚠️ Are you sure? This track will be permanently removed from your library and all playlists.'}
                </p>
                <div className="modal-actions-stack">
                  <button
                    type="button"
                    className="modal-btn-danger"
                    onClick={() => {
                      deleteTrackCompletely(deleteTrackModal);
                      setConfirmDeleteTrackCompletely(false);
                    }}
                  >
                    Yes, Permanently Delete
                  </button>
                  <button
                    type="button"
                    className="modal-btn-secondary"
                    onClick={() => setConfirmDeleteTrackCompletely(false)}
                  >
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 3. IMPORT PLAYLIST MODAL */}
      {importPlaylistModal && createPortal(
        <div
          className="modal-overlay"
          onClick={() => !importing && setImportPlaylistModal(null)}
        >
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Import Playlist</h3>
            <p className="modal-target-badge">
              {importPlaylistModal.title} ({importPlaylistModal.count} tracks)
            </p>
            <p className="modal-description">
              Do you want to create a new dedicated playlist for these tracks, or add them all to your main library?
            </p>
            <div className="modal-actions-stack">
              <button
                type="button"
                className="modal-btn-primary"
                onClick={() => handleImportPlaylist(true)}
                disabled={importing}
              >
                {importing ? 'Importing...' : 'Create Playlist & Add Tracks'}
              </button>
              <button
                type="button"
                className="modal-btn-secondary"
                onClick={() => handleImportPlaylist(false)}
                disabled={importing}
              >
                {importing ? 'Importing...' : 'Add to Main Library Only'}
              </button>
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={() => setImportPlaylistModal(null)}
                disabled={importing}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 4. EDIT PLAYLIST MODAL (RENAME / COVER) */}
      {editPlaylistModal && createPortal(
        <div className="modal-overlay" onClick={() => setEditPlaylistModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">
              {editPlaylistModal.editMode === 'cover' ? 'Edit Playlist Cover' : 'Rename Playlist'}
            </h3>
            <p className="modal-description">
              {editPlaylistModal.editMode === 'cover'
                ? 'Enter a direct image URL for the playlist cover art:'
                : 'Enter a new title for this playlist:'}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                let newName = editPlaylistModal.name;
                let newIcon = editPlaylistModal.icon;

                if (editPlaylistModal.editMode === 'cover') {
                  const iconInput = form.elements.namedItem('plicon') as HTMLInputElement;
                  if (iconInput) newIcon = iconInput.value;
                } else {
                  const input = form.elements.namedItem('plname') as HTMLInputElement;
                  if (input) newName = input.value;
                }

                editPlaylist(editPlaylistModal.id, newName || undefined, newIcon || undefined);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div className="modal-form-group">
                <label className="modal-label" htmlFor={editPlaylistModal.editMode === 'cover' ? 'plicon' : 'plname'}>
                  {editPlaylistModal.editMode === 'cover' ? 'Cover image URL:' : 'Playlist title:'}
                </label>
                {editPlaylistModal.editMode === 'cover' ? (
                  <input
                    id="plicon"
                    name="plicon"
                    type="url"
                    autoFocus
                    defaultValue={editPlaylistModal.icon || ''}
                    placeholder="https://example.com/cover.jpg"
                    className="modal-input-field"
                  />
                ) : (
                  <input
                    id="plname"
                    name="plname"
                    type="text"
                    autoFocus
                    required
                    defaultValue={editPlaylistModal.name}
                    placeholder="Playlist name..."
                    className="modal-input-field"
                  />
                )}
              </div>
              <div className="modal-actions-stack">
                <button type="submit" className="modal-btn-primary">
                  Save Changes
                </button>
                <button type="button" onClick={() => setEditPlaylistModal(null)} className="modal-btn-cancel">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 5. DELETE PLAYLIST MODAL */}
      {deletePlaylistModal && createPortal(
        <div
          className="modal-overlay"
          onClick={() => {
            setDeletePlaylistModal(null);
            setConfirmDeletePlaylistWithTracks(false);
          }}
        >
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Delete Playlist</h3>
            <p className="modal-target-badge">{deletePlaylistModal.name}</p>

            {deletePlaylistModal.trackCount === 0 ? (
              <>
                <p className="modal-description">
                  This playlist is empty. Are you sure you want to delete it?
                </p>
                <div className="modal-actions-stack">
                  <button
                    type="button"
                    className="modal-btn-danger"
                    onClick={() => deletePlaylist(deletePlaylistModal.id, false)}
                  >
                    Yes, Delete Playlist
                  </button>
                  <button
                    type="button"
                    className="modal-btn-cancel"
                    onClick={() => setDeletePlaylistModal(null)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : !confirmDeletePlaylistWithTracks ? (
              <>
                <p className="modal-description">
                  This playlist contains {deletePlaylistModal.trackCount} tracks. Do you want to delete the playlist only, or also delete all its tracks from your library?
                </p>
                <div className="modal-actions-stack">
                  <button
                    type="button"
                    className="modal-btn-secondary"
                    onClick={() => {
                      deletePlaylist(deletePlaylistModal.id, false);
                      setConfirmDeletePlaylistWithTracks(false);
                    }}
                  >
                    Delete Playlist Only
                  </button>
                  <button
                    type="button"
                    className="modal-btn-danger"
                    onClick={() => setConfirmDeletePlaylistWithTracks(true)}
                  >
                    Delete Playlist AND Its Tracks
                  </button>
                  <button
                    type="button"
                    className="modal-btn-cancel"
                    onClick={() => setDeletePlaylistModal(null)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="modal-description modal-warning-text">
                  ⚠️ Warning: All {deletePlaylistModal.trackCount} tracks in this playlist will be permanently removed from your library! Are you sure?
                </p>
                <div className="modal-actions-stack">
                  <button
                    type="button"
                    className="modal-btn-danger"
                    onClick={() => {
                      deletePlaylist(deletePlaylistModal.id, true);
                      setConfirmDeletePlaylistWithTracks(false);
                    }}
                  >
                    Yes, Delete Playlist and All Tracks
                  </button>
                  <button
                    type="button"
                    className="modal-btn-secondary"
                    onClick={() => setConfirmDeletePlaylistWithTracks(false)}
                  >
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

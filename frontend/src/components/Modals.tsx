import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, ListMusic, Info, Search, Filter, Trash2, MoreVertical, Music, BarChart2, Home, Plus, Upload, Settings, LogOut, Palette, ChevronLeft, ChevronRight } from 'lucide-react';

export const Modals = () => {
  const player = usePlayer();
  const { 
      status, setStatus, tracks, setTracks, newTrackInput, setNewTrackInput,
      editPlaylistModal, setEditPlaylistModal, deletePlaylistModal, setDeletePlaylistModal, editPlaylist, deletePlaylist,
      seekValue, setSeekValue, playlists, setPlaylists, isModalOpen, setIsModalOpen,
      newPlaylistName, setNewPlaylistName, activeMenuId, setActiveMenuId,
      menuView, setMenuView, activePlaylistId, setActivePlaylistId,
      selectedTrack, setSelectedTrack, trackPlaylists, setTrackPlaylists,
      searchQuery, setSearchQuery, showSearch, setShowSearch,
      rightPanelMode, setRightPanelMode, importPlaylistModal, setImportPlaylistModal,
      importing, setImporting, deleteTrackModal, setDeleteTrackModal,
      rightCollapsed, setRightCollapsed, theme, setTheme, leftCollapsed, setLeftCollapsed,
      fetchTracks, fetchPlaylists, fetchStatus, handleAction, handleAddTrack,
      handleImportPlaylist, deleteTrackCompletely, deleteTrackFromPlaylist,
      handleDeleteTrack, handlePlayTrack, handleFileUpload, handleCreatePlaylist,
      handleAddToPlaylist, formatTime, toggleTheme, handleRightToggle,
      USER_ID, duration, elapsed, filteredTracks, playlistName
  } = player;

  return (
    <>
      {isModalOpen && (
        <div className="modal-overlay" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'}} onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-light)', minWidth: '300px'}} onClick={e => e.stopPropagation()}>
            <h3 style={{margin: '0 0 16px 0'}}>New Playlist</h3>
            <form onSubmit={handleCreatePlaylist} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input 
                id="newPlaylistName"
                name="newPlaylistName"
                type="text" 
                autoFocus
                placeholder="Playlist name..." 
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                style={{padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.2)', color: 'white'}}
              />
              <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer'}}>Cancel</button>
                <button type="submit" style={{padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: 'white', cursor: 'pointer'}}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTrackModal && (
        <div className="modal-overlay" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'}} onClick={() => setDeleteTrackModal(null)}>
          <div className="modal-content" style={{background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-light)', maxWidth: '400px'}} onClick={e => e.stopPropagation()}>
            <h3 style={{margin: '0 0 8px 0'}}>Remove Track</h3>
            <p style={{margin: '0 0 16px 0'}}><strong>{deleteTrackModal.title || deleteTrackModal.query}</strong></p>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
              Do you want to remove this track from the current playlist, or delete it completely from your library?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                className="delete-option-btn"
                onClick={() => deleteTrackFromPlaylist(deleteTrackModal)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer' }}
              >
                Remove from Playlist Only
              </button>
              <button 
                onClick={() => {
                  const isLocal = deleteTrackModal.type === 'local';
                  const msg = isLocal 
                    ? 'Вы уверены, что хотите удалить этот локальный файл? (Он будет навсегда удален с жесткого диска!)' 
                    : 'Вы уверены, что хотите полностью удалить этот трек из библиотеки?';
                  if (window.confirm(msg)) {
                    deleteTrackCompletely(deleteTrackModal);
                  }
                }}
                className="delete-option-btn danger"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 60, 60, 0.5)', background: 'rgba(255, 60, 60, 0.2)', color: '#ff5555', cursor: 'pointer' }}
              >
                Delete Completely from Library
              </button>
              <button 
                className="delete-option-btn"
                onClick={() => setDeleteTrackModal(null)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer', marginTop: '8px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {importPlaylistModal && (
        <div className="modal-overlay" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'}} onClick={() => !importing && setImportPlaylistModal(null)}>
          <div className="modal-content" style={{background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-light)', maxWidth: '400px'}} onClick={e => e.stopPropagation()}>
            <h3 style={{margin: '0 0 8px 0'}}>Import Playlist</h3>
            <p style={{margin: '0 0 8px 0'}}>Detected playlist <strong>{importPlaylistModal.title}</strong> with {importPlaylistModal.count} tracks.</p>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
              Do you want to create a new folder (playlist) for these tracks, or just add them all to the main library?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={() => handleImportPlaylist(true)}
                disabled={importing}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: 'white', cursor: importing ? 'not-allowed' : 'pointer' }}
              >
                {importing ? 'Importing...' : 'Create Playlist & Add Tracks'}
              </button>
              <button 
                onClick={() => handleImportPlaylist(false)}
                disabled={importing}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', cursor: importing ? 'not-allowed' : 'pointer' }}
              >
                {importing ? 'Importing...' : 'Add to Main Library Only'}
              </button>
              <button 
                onClick={() => setImportPlaylistModal(null)}
                disabled={importing}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'white', cursor: importing ? 'not-allowed' : 'pointer', marginTop: '8px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    
      {editPlaylistModal && (
        <div className="modal-overlay" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'}} onClick={() => setEditPlaylistModal(null)}>
          <div className="modal-content" style={{background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-light)', minWidth: '300px'}} onClick={e => e.stopPropagation()}>
                        <h3 style={{margin: '0 0 16px 0'}}>{editPlaylistModal.editMode === 'cover' ? 'Edit Cover' : 'Rename Playlist'}</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.target;
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
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {editPlaylistModal.editMode === 'cover' ? (
                <input 
                  id="plicon"
                  name="plicon"
                  type="text" 
                  autoFocus
                  defaultValue={editPlaylistModal.icon || ''}
                  placeholder="Playlist cover URL..." 
                  style={{padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.2)', color: 'white'}}
                />
              ) : (
                <input 
                  id="plname"
                  name="plname"
                  type="text" 
                  autoFocus
                  defaultValue={editPlaylistModal.name}
                  placeholder="Playlist name..." 
                  style={{padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.2)', color: 'white'}}
                />
              )}
              <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
                <button type="button" onClick={() => setEditPlaylistModal(null)} style={{padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer'}}>Cancel</button>
                <button type="submit" style={{padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: 'white', cursor: 'pointer'}}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletePlaylistModal && (
        <div className="modal-overlay" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'}} onClick={() => setDeletePlaylistModal(null)}>
          <div className="modal-content" style={{background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-light)', maxWidth: '400px'}} onClick={e => e.stopPropagation()}>
            <h3 style={{margin: '0 0 8px 0'}}>Delete Playlist</h3>
            <p style={{margin: '0 0 16px 0'}}><strong>{deletePlaylistModal.name}</strong></p>
            {deletePlaylistModal.trackCount === 0 ? (
              <>
                <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
                  This playlist is empty. Are you sure you want to delete it?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button 
                    onClick={() => deletePlaylist(deletePlaylistModal.id, false)}
                    className="delete-option-btn danger"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 60, 60, 0.5)', background: 'rgba(255, 60, 60, 0.2)', color: '#ff5555', cursor: 'pointer' }}
                  >
                    Yes, Delete Playlist
                  </button>
                  <button 
                    className="delete-option-btn"
                  onClick={() => setDeletePlaylistModal(null)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer', marginTop: '8px' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
                  This playlist has {deletePlaylistModal.trackCount} tracks. Do you want to delete the playlist only, or also completely delete all its tracks from your library?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button 
                    className="delete-option-btn"
                    onClick={() => deletePlaylist(deletePlaylistModal.id, false)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer' }}
                  >
                    Delete Playlist Only
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm('Вы уверены? Музыка будет полностью удалена из библиотеки!')) {
                        deletePlaylist(deletePlaylistModal.id, true);
                      }
                    }}
                    className="delete-option-btn danger"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 60, 60, 0.5)', background: 'rgba(255, 60, 60, 0.2)', color: '#ff5555', cursor: 'pointer' }}
                  >
                    Delete Playlist AND its Tracks
                  </button>
                  <button 
                    className="delete-option-btn"
                  onClick={() => setDeletePlaylistModal(null)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer', marginTop: '8px' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
</>
  );
};

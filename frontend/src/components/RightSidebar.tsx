import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, ListMusic, Info, Search, Filter, Trash2, MoreVertical, Music, BarChart2, Home, Plus, Upload, Settings, LogOut, Palette, ChevronLeft, ChevronRight } from 'lucide-react';

export const RightSidebar = () => {
  const player = usePlayer();
  const { 
      status, setStatus, tracks, setTracks, newTrackInput, setNewTrackInput,
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
      handleAddToPlaylist, formatTime, toggleTheme, handleRightToggle
  } = player;

  return (
    <>
      <aside className={`right-sidebar ${rightCollapsed ? 'collapsed' : ''}`}>
          <div className="right-sidebar-inner">
            <div className="right-sidebar-content">
              {rightPanelMode === 'queue' ? (
                <div className="queue-view">
                  <div className="queue-stair-1">
                    <h2 className="queue-title">Queue: {status.activePlaylistName || 'Main Library'}</h2>
                  </div>
                  
                  <div className="queue-stair-2">
                    <h3 className="section-title">Now playing</h3>
                    {status.currentTrack ? (
                      <div className="queue-track">
                        <div className="track-icon-lg">
                          {status.currentTrack.thumbnail ? (
                            <img src={status.currentTrack.thumbnail.startsWith('/') ? `http://localhost:3001${status.currentTrack.thumbnail}` : status.currentTrack.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} alt="thumb" />
                          ) : (
                            <Music size={20} />
                          )}
                        </div>
                        <div className="queue-track-info">
                          <span className="queue-track-name">{status.currentTrack.title || status.currentTrack.query}</span>
                          <span className="queue-track-author">{status.currentTrack.artist || 'Unknown'}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Empty</div>
                    )}
                  </div>
                  
                  <div className="queue-stair-3">
                    <h3 className="section-title">Next</h3>
                    {status.queue && status.queue.length > 0 ? (
                      status.queue.map((qTrack: any, i: number) => (
                        <div className="queue-track" key={i}>
                          <div className="track-icon-lg">
                            {qTrack.thumbnail ? (
                              <img src={qTrack.thumbnail.startsWith('/') ? `http://localhost:3001${qTrack.thumbnail}` : qTrack.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} alt="thumb" />
                            ) : (
                              <Music size={20} />
                            )}
                          </div>
                          <div className="queue-track-info">
                            <span className="queue-track-name">{qTrack.title || qTrack.query}</span>
                            <span className="queue-track-author">{qTrack.artist || 'Unknown'}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Queue is empty</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="track-info-view">
                  {selectedTrack ? (
                    <>
                      <div className="ti-stair-1">
                        <div className="large-art">
                          {selectedTrack.thumbnail ? (
                            <img src={selectedTrack.thumbnail.startsWith('/') ? `http://localhost:3001${selectedTrack.thumbnail}` : selectedTrack.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }} alt="art" />
                          ) : (
                            <div className="cd-circle">
                              <div className="cd-hole"></div>
                            </div>
                          )}
                        </div>
                        <h2 className="ti-title">{selectedTrack.title || selectedTrack.query || selectedTrack.name || 'Unknown'}</h2>
                        <span className="ti-author">{selectedTrack.artist || 'Unknown'}</span>
                      </div>
                      
                      <div className="ti-stair-2">
                        <div className="ti-details">
                          <div className="ti-detail-item">Platform: {selectedTrack.type === 'local' ? 'Local File' : 'YouTube'}</div>
                          {selectedTrack.url && (
                            <div className="ti-detail-item">URL: <a href={selectedTrack.url} target="_blank" rel="noreferrer" style={{color: 'var(--accent)'}}>Link</a></div>
                          )}
                          <div className="ti-detail-item">Is in: {trackPlaylists.length > 0 ? trackPlaylists.join(', ') : '—'}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>Select a track to view info</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
    </>
  );
};

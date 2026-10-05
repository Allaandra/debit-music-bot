import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, ListMusic, Info, Search, Filter, Trash2, MoreVertical, Music, BarChart2, Home, Plus, Upload, Settings, LogOut, Palette, ChevronLeft, ChevronRight } from 'lucide-react';

export const MainPanel = () => {
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
      handleAddToPlaylist, formatTime, toggleTheme, handleRightToggle,
      USER_ID, duration, elapsed, filteredTracks, playlistName
  } = player;

  return (
    <>
      <main className="center-panel">
          <div className="center-header">
            <div className="header-left">
              <div className="glass-card title-card">
                <h1 className="playlist-title">Playlist: {playlistName}</h1>
              </div>
              <div className="glass-card meta-pill">
                <span className="track-count">{tracks.length} tracks</span>
              </div>
            </div>
            
            <div className="glass-card meta-pill">
              <span className="track-count">Created Sep 2026</span>
            </div>
          </div>
          
          <div className="center-content">
            <div className="content-box">
              <div className="controls-row">
                <button className="play-btn-large" onClick={() => {
                  if (filteredTracks.length > 0) handlePlayTrack(filteredTracks[0]);
                }}>
                  <Play size={16} fill="currentColor" style={{marginLeft: '2px'}} />
                </button>
                <button className="icon-btn" style={{background: 'none', border: 'none', padding: 0}} onClick={() => handleAction('shuffle')}>
                  <Shuffle size={20} color={status.shuffle ? "var(--accent)" : "var(--text-muted)"} />
                </button>
                <button className="icon-btn" style={{background: 'none', border: 'none', padding: 0, position: 'relative'}} onClick={() => handleAction('repeat')}>
                  <Repeat size={20} color={status.repeatMode !== 'off' ? "var(--accent)" : "var(--text-muted)"} />
                  {status.repeatMode === 'track' && (
                    <span style={{ position: 'absolute', top: -5, right: -5, fontSize: '10px', fontWeight: 'bold', color: '#fff', background: 'var(--accent)', borderRadius: '50%', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                  )}
                </button>
                
                <div className="controls-right">
                  <button className="icon-btn" style={{background: 'none', border: 'none', padding: 0}} onClick={() => setShowSearch(!showSearch)}>
                    <Search size={20} color={showSearch ? "var(--accent)" : "var(--text-muted)"} />
                  </button>
                  <Filter size={20} color="var(--text-muted)" />
                </div>
              </div>

              {showSearch && (
                <div style={{ padding: '0 20px', marginBottom: '10px' }}>
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--glass-bg)', color: 'var(--text-primary)' }}
                    autoFocus
                  />
                </div>
              )}
              
              <div className="track-list">
                <div className="track-row track-header">
                  <div className="track-num" style={{textAlign: 'center'}}>№</div>
                  <div className="track-title-col">Title</div>
                  <div className="track-duration-col">Duration</div>
                </div>
                
                {filteredTracks.map((track: any, index: number) => {
                  const isCurrentTrack = status.currentTrack && (status.currentTrack.id === track.id || status.currentTrack.query === track.query);
                  const isPlaying = isCurrentTrack && status.isPlaying && !status.isPaused;
                  const isPaused = isCurrentTrack && status.isPaused;

                  return (
                    <div 
                      key={index} 
                      className={`track-row ${isCurrentTrack ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedTrack(track);
                        handlePlayTrack(track);
                      }}
                    >
                      <div className="track-num">
                        {isPlaying ? (
                          <BarChart2 size={16} />
                        ) : isPaused ? (
                          <Pause size={16} />
                        ) : isCurrentTrack ? (
                          <Play size={16} fill="currentColor" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div className="track-title-col">
                        <div className="track-icon">
                          {track.thumbnail ? (
                            <img src={track.thumbnail.startsWith('/') ? `http://localhost:3001${track.thumbnail}` : track.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} alt="thumb" />
                          ) : (
                            <Music size={16} />
                          )}
                        </div>
                        <span className="track-name">{track.title || track.name || track.query || track.url || 'Unknown Track'}</span>
                      </div>
                      <div className="track-duration-col" style={{position: 'relative'}}>
                        {formatTime(track.duration || 0)} 
                        <button 
                          className="icon-btn" 
                          style={{background: 'none', border: 'none', padding: 0}}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === track.id ? null : track.id);
                            setMenuView('main');
                          }} 
                        >
                          <MoreVertical size={16} className="more-btn" />
                        </button>
                        
                        {activeMenuId === track.id && (
                          <div className="dropdown-menu" style={{
                            position: 'absolute', right: 0, top: '100%', zIndex: 10,
                            background: 'var(--glass-bg)', backdropFilter: 'blur(10px)',
                            border: '1px solid var(--border-light)', borderRadius: '8px',
                            minWidth: '150px', padding: '4px 0',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                          }}>
                            {menuView === 'main' ? (
                              <>
                                <div 
                                  className="dropdown-item"
                                  onClick={(e) => { e.stopPropagation(); setMenuView('playlists'); }}
                                  style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                                >
                                  <span>Add to playlist</span>
                                  <span style={{ fontSize: '10px', marginTop: '4px' }}>▶</span>
                                </div>
                                <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }}></div>
                                <div 
                                  className="dropdown-item"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteTrack(e, track); }}
                                  style={{ padding: '8px 16px', cursor: 'pointer', color: '#ff5555', display: 'flex', justifyContent: 'space-between' }}
                                >
                                  <span>Delete</span>
                                  <Trash2 size={14} />
                                </div>
                              </>
                            ) : (
                              <>
                                <div 
                                  className="dropdown-item"
                                  onClick={(e) => { e.stopPropagation(); setMenuView('main'); }}
                                  style={{ padding: '8px 16px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                >
                                  <span>← Back</span>
                                </div>
                                <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }}></div>
                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                  {playlists.length === 0 && <div style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '14px' }}>No playlists</div>}
                                  {playlists.map((pl: any) => (
                                    <div 
                                      key={pl.id} 
                                      className="dropdown-item"
                                      onClick={(e) => { e.stopPropagation(); handleAddToPlaylist(e, track.id, pl.id); }}
                                      style={{ padding: '8px 16px', cursor: 'pointer' }}
                                    >
                                      <span>{pl.name}</span>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
    </>
  );
};

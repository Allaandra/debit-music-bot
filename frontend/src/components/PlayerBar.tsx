import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, ListMusic, Info, Swords, Search, Filter, Trash2, MoreVertical, Music, BarChart2, Home, Plus, Upload, Settings, LogOut, Palette, ChevronLeft, ChevronRight } from 'lucide-react';

export const PlayerBar = () => {
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
      <footer className="bottom-bar">
        <div className="now-playing-left">
          {status.currentTrack && (
            <>
              <div className="track-icon-lg">
                {status.currentTrack.thumbnail ? (
                  <img src={status.currentTrack.thumbnail.startsWith('/') ? `http://localhost:3001${status.currentTrack.thumbnail}` : status.currentTrack.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} alt="thumb" />
                ) : (
                  <Music size={24} />
                )}
              </div>
              <div className="queue-track-info">
                <span className="queue-track-name">{status.currentTrack.title || status.currentTrack.query}</span>
                <span className="queue-track-author">{status.currentTrack.artist || 'Unknown'}</span>
              </div>
            </>
          )}
        </div>
        
        <div className="player-controls-center">
          <div className="main-controls">
            <button style={{background: 'none', border: 'none', padding: 0}} onClick={() => handleAction('shuffle')}><Shuffle size={18} color={status.shuffle ? "var(--accent)" : "currentColor"} /></button>
            <button style={{background: 'none', border: 'none', padding: 0}} onClick={() => handleAction('previous')}><SkipBack size={20} fill="currentColor" /></button>
            <button className="play-btn" onClick={() => {
              if (status.isPlaying && !status.isPaused) handleAction('pause');
              else if (status.currentTrack) handleAction('resume');
            }}>
              {status.isPlaying && !status.isPaused ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{marginLeft: '2px'}} />}
            </button>
            <button style={{background: 'none', border: 'none', padding: 0}} onClick={() => handleAction('skip', { direction: 1 })}><SkipForward size={20} fill="currentColor" /></button>
            <button style={{background: 'none', border: 'none', padding: 0, position: 'relative'}} onClick={() => handleAction('repeat')}>
              <Repeat size={18} color={status.repeatMode !== 'off' ? "var(--accent)" : "currentColor"} />
              {status.repeatMode === 'track' && (
                <span style={{ position: 'absolute', top: -4, right: -4, fontSize: '9px', fontWeight: 'bold', color: '#fff', background: 'var(--accent)', borderRadius: '50%', width: '10px', height: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
              )}
            </button>
          </div>
          <div className="progress-bar-container">
            <span>{formatTime(elapsed)}</span>
            <div className="progress-bar" style={{position: 'relative'}}>
              <input id="seek-bar" name="seekBar" type="range" min="0" max={duration || 100} 
                value={elapsed} 
                onChange={(e) => setSeekValue(Number(e.target.value))}
                onMouseUp={(e) => {
                  handleAction('seek', { seconds: Number(e.currentTarget.value) });
                  setSeekValue(null);
                }}
                style={{ width: '100%', position: 'absolute', zIndex: 2, opacity: 0, cursor: 'pointer', height: '100%' }}
                disabled={!duration}
              />
              <div className="progress-filled" style={{width: `${duration ? (elapsed / duration) * 100 : 0}%`}}></div>
              <div className="progress-thumb" style={{left: `calc(${duration ? (elapsed / duration) * 100 : 0}% - 4px)`}}></div>
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        
        <div className="right-controls">
          <button style={{background: 'none', border: 'none', padding: 0}} title="Очередь" className={rightPanelMode === 'queue' && !rightCollapsed ? 'active-icon' : ''} onClick={() => handleRightToggle('queue')}><ListMusic size={18} /></button>
          <button style={{background: 'none', border: 'none', padding: 0}} title="Звуковые эффекты (SFX)" className={rightPanelMode === 'sfx' && !rightCollapsed ? 'active-icon' : ''} onClick={() => handleRightToggle('sfx')}><Swords size={18} /></button>
          <button style={{background: 'none', border: 'none', padding: 0}} title="Информация о треке" className={rightPanelMode === 'info' && !rightCollapsed ? 'active-icon' : ''} onClick={() => handleRightToggle('info')}><Info size={18} /></button>
          <Volume2 size={18} />
          <div className="volume-bar" style={{position: 'relative'}}>
            <input id="volume-bar" name="volumeBar" type="range" min="0" max="100" defaultValue="50" style={{position: 'absolute', width: '100%', opacity: 0, cursor: 'pointer', zIndex: 2}} />
            <div className="volume-filled" style={{width: '50%'}}></div>
          </div>
        </div>
      </footer>
    </>
  );
};


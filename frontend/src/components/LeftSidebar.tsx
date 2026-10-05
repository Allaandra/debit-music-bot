import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, ListMusic, Info, Search, Filter, Trash2, MoreVertical, Music, BarChart2, Home, Plus, Upload, Settings, LogOut, Palette, ChevronLeft, ChevronRight } from 'lucide-react';

export const LeftSidebar = () => {
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
      <aside className={`left-sidebar ${leftCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-inner">
            <form onSubmit={handleAddTrack} className="search-bar-container">
              <button type="button" className="icon-btn toggle-btn" onClick={() => setLeftCollapsed(!leftCollapsed)}>
                {leftCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
              <input 
                type="text" 
                className="search-input" 
                placeholder="url / name" 
                value={newTrackInput}
                onChange={(e) => setNewTrackInput(e.target.value)}
              />
              <button type="submit" className="icon-btn"><Plus size={16} /></button>
              <label className="icon-btn" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Upload size={16} />
                <input type="file" accept=".mp3,.wav,.ogg" style={{ display: 'none' }} onChange={handleFileUpload} />
              </label>
            </form>
            
            <div className="nav-section">
              <div 
                className={`nav-item ${activePlaylistId === null ? "active" : ""}`}
                onClick={() => {
                  setActivePlaylistId(null);
                  fetchTracks(null);
                }}
              >
                <Home size={20} />
                <span>Home page</span>
              </div>
            </div>
            
            <div className="playlists-section">
              <div className="nav-item new-playlist" onClick={() => setIsModalOpen(true)}>
                <Plus size={20} />
                <span>New Playlist</span>
              </div>
              {playlists.map((pl: any) => (
                <div 
                  className={`nav-item ${activePlaylistId === pl.id ? 'active' : ''}`} 
                  key={pl.id}
                  onClick={() => {
                    setActivePlaylistId(pl.id);
                    fetchTracks(pl.id);
                  }}
                >
                  <Music size={20} />
                  <span className="hide-on-collapse">{pl.name}</span>
                </div>
              ))}
            </div>

            <div className="user-section">
              <div className="user-avatar"></div>
              <span className="user-name">{USER_ID}</span>
              <LogOut size={20} className="text-icon"  />
              <Palette size={20} className="text-icon palette-btn"  onClick={toggleTheme} />
              <Settings size={20} className="text-icon"  />
            </div>
          </div>
        </aside>
    </>
  );
};

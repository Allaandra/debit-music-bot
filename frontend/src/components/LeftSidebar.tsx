import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../services/api';
import { Trash2, MoreVertical, Music, Home, Plus, Upload, Settings, LogOut, Palette, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';

export const LeftSidebar = () => {
  const [activePlaylistMenuId, setActivePlaylistMenuId] = React.useState<number | null>(null);
  const {
    newTrackInput,
    setNewTrackInput,
    setEditPlaylistModal,
    setDeletePlaylistModal,
    playlists,
    setIsModalOpen,
    activePlaylistId,
    setActivePlaylistId,
    leftCollapsed,
    setLeftCollapsed,
    fetchTracks,
    handleAddTrack,
    handleFileUpload,
    toggleTheme,
    user
  } = usePlayer();

  React.useEffect(() => {
    const handleClickOutside = () => {
      setActivePlaylistMenuId(null);
    };
    if (activePlaylistMenuId !== null) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activePlaylistMenuId]);

  return (
    <>
      <aside className={`left-sidebar ${leftCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-inner">
            <form onSubmit={handleAddTrack} className="search-bar-container">
              <button type="button" className="icon-btn toggle-btn" onClick={() => setLeftCollapsed(!leftCollapsed)}>
                {leftCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
              <input id="search-input" name="searchInput" type="text" className="search-input" 
                placeholder="url / name" 
                value={newTrackInput}
                onChange={(e) => setNewTrackInput(e.target.value)}
              />
              <button type="submit" className="icon-btn"><Plus size={16} /></button>
              <label className="icon-btn" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Upload size={16} />
                <input id="fileUpload" name="fileUpload" type="file" accept=".mp3,.wav,.ogg" style={{ display: 'none' }} onChange={handleFileUpload} />
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
                  data-playlist-id={pl.id}
                  data-playlist-name={pl.name}
                  onClick={() => {
                    setActivePlaylistId(pl.id);
                    fetchTracks(pl.id);
                  }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', overflow: 'hidden' }}>
                    {pl.icon ? <img src={pl.icon} style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} alt="cover" /> : <Music size={20} style={{ flexShrink: 0 }} />}
                    <span className="hide-on-collapse" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</span>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <MoreVertical 
                      size={16} 
                      className="text-icon hide-on-collapse" 
                      style={{ flexShrink: 0, opacity: 0.7 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePlaylistMenuId(activePlaylistMenuId === pl.id ? null : pl.id);
                      }} 
                    />
                    {activePlaylistMenuId === pl.id && (
                      <div className="dropdown-menu" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 10, background: 'var(--glass-bg)', padding: '4px 0', borderRadius: '8px', border: '1px solid var(--border-light)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', minWidth: '150px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
                        <div className="dropdown-item" onClick={(e) => { e.stopPropagation(); setEditPlaylistModal({ ...pl, editMode: 'rename' }); setActivePlaylistMenuId(null); }}>
                          <Edit2 size={16} /> Rename
                        </div>
                        <div className="dropdown-item" onClick={(e) => { e.stopPropagation(); setEditPlaylistModal({ ...pl, editMode: 'cover' }); setActivePlaylistMenuId(null); }}>
                          <Palette size={16} /> Edit Cover
                        </div>
                        <div className="dropdown-item" style={{ color: '#ff5555' }} onClick={(e) => { e.stopPropagation(); setDeletePlaylistModal(pl); setActivePlaylistMenuId(null); }}>
                          <Trash2 size={16} /> Delete
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="user-section">
              <img src={user?.avatar || ""} className="user-avatar" style={{ backgroundColor: user?.avatar ? "transparent" : "#5865F2" }} alt="" />
              <span className="user-name">{user?.username || "Guest"}</span>
              <LogOut size={20} className="text-icon" onClick={async () => {
                await api.logout();
                window.location.href = '/';
              }} style={{ cursor: 'pointer' }} />
              <Palette size={20} className="text-icon palette-btn" onClick={toggleTheme} />
              <span
                className="text-icon"
                title="Настройки"
                style={{ cursor: 'pointer', display: 'inline-flex' }}
              >
                <Settings size={20} />
              </span>
            </div>
          </div>
        </aside>
    </>
  );
};




import React, { useEffect, useState } from 'react';
import './assets/css/Player.css';
import { 
  Home, Plus, Upload, Music, Settings, LogOut, Search, Filter, 
  Play, SkipBack, SkipForward, Repeat, Shuffle, Volume2, Info, ListMusic,
  MoreVertical, BarChart2, Palette,  ChevronLeft, ChevronRight,
   Trash2,   Pause
} from 'lucide-react';

const USER_ID = '450362999073406977';

export default function App() {
  const [status, setStatus] = useState<any>({
    currentTrack: null,
    elapsed: 0,
    isPlaying: false,
    duration: 0,
    queue: []
  });
  const [tracks, setTracks] = useState<any[]>([]);
  const [newTrackInput, setNewTrackInput] = useState('');
  const [seekValue, setSeekValue] = useState<number | null>(null);

  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuView, setMenuView] = useState<'main' | 'playlists'>('main');
  const [activePlaylistId, setActivePlaylistId] = useState<number | null>(null);
  
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [trackPlaylists, setTrackPlaylists] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<'queue' | 'info'>('queue');
  const [importPlaylistModal, setImportPlaylistModal] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [deleteTrackModal, setDeleteTrackModal] = useState<any>(null);

  // Layout states
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [theme, setTheme] = useState<'forest' | 'dark' | 'light'>('forest');
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  const toggleTheme = () => {
    setTheme(prev => prev === 'forest' ? 'dark' : prev === 'dark' ? 'light' : 'forest');
  };

  const handleRightToggle = (view: 'queue' | 'info') => {
    if (rightPanelMode === view && !rightCollapsed) {
      setRightCollapsed(true);
    } else {
      setRightPanelMode(view);
      setRightCollapsed(false);
    }
  };

  const fetchTracks = async (playlistId: number | null = activePlaylistId) => {
    try {
      let url = `http://localhost:3001/api/tracks?userId=${USER_ID}`;
      if (playlistId) {
        url = `http://localhost:3001/api/playlists/${playlistId}/tracks?userId=${USER_ID}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTracks(Array.isArray(data) ? data : (data.tracks || []));
      }
    } catch (e) {
      console.error('Failed to fetch tracks', e);
    }
  };

  const fetchPlaylists = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/playlists');
      const data = await res.json();
      setPlaylists(data);
    } catch (e) {
      console.error('Failed to fetch playlists', e);
    }
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/status?userId=${USER_ID}`);
        if (res.ok) {
          const data = await res.json();
          setStatus((prev: any) => ({ ...prev, ...data, queue: data.queue || [] }));
        }
      } catch (e) {
        console.error('Failed to fetch status', e);
      }
    };
    
    fetchStatus();
    fetchTracks();
    fetchPlaylists();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedTrack || playlists.length === 0) { setTrackPlaylists([]); return; }
    Promise.all(
      playlists.map(pl =>
        fetch(`http://localhost:3001/api/playlists/${pl.id}/tracks`)
          .then(r => r.json())
          .then((tracks: any[]) => tracks.some((t: any) => t.id === selectedTrack.id) ? pl.name : null)
          .catch(() => null)
      )
    ).then(results => {
      setTrackPlaylists(results.filter(Boolean) as string[]);
    });
  }, [selectedTrack, playlists]);

  const handleAction = async (action: string, payload?: any) => {
    try {
      await fetch('http://localhost:3001/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          action,
          payload
        })
      });
    } catch (e) {
      console.error(`Failed to execute action ${action}`, e);
    }
  };

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrackInput) return;
    try {
      const res = await fetch('http://localhost:3001/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          query: newTrackInput,
          type: 'url'
        })
      });
      const data = await res.json();
      
      if (data.status === 'playlist_detected') {
        setImportPlaylistModal({ query: newTrackInput, title: data.title, count: data.total_tracks });
        setNewTrackInput('');
        return;
      }

      setNewTrackInput('');
      fetchTracks();
    } catch (e) {
      console.error('Failed to add track', e);
    }
  };

  const handleImportPlaylist = async (createPlaylist: boolean) => {
    if (!importPlaylistModal) return;
    setImporting(true);
    try {
      await fetch('http://localhost:3001/api/tracks/import_playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          query: importPlaylistModal.query,
          createPlaylist,
          playlistName: importPlaylistModal.title
        })
      });
      setImportPlaylistModal(null);
      fetchPlaylists();
      fetchTracks();
    } catch (e) {
      console.error('Failed to import playlist', e);
    } finally {
      setImporting(false);
    }
  };

  const deleteTrackCompletely = async (track: any) => {
    try {
      await fetch(`http://localhost:3001/api/tracks/${track.id}?userId=${USER_ID}`, { method: 'DELETE' });
      fetchTracks();
      if (selectedTrack && selectedTrack.id === track.id) {
        setSelectedTrack(null);
      }
      setDeleteTrackModal(null);
    } catch (e) {
      console.error('Failed to delete track', e);
    }
  };

  const deleteTrackFromPlaylist = async (track: any) => {
    if (activePlaylistId === null) return;
    try {
      await fetch(`http://localhost:3001/api/playlists/${activePlaylistId}/tracks/${track.id}`, { method: 'DELETE' });
      fetchTracks();
      setDeleteTrackModal(null);
    } catch (e) {
      console.error('Failed to remove from playlist', e);
    }
  };

  const handleDeleteTrack = async (e: React.MouseEvent, track: any) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (activePlaylistId !== null) {
      setDeleteTrackModal(track);
    } else {
      const isLocal = track.type === 'local';
      const msg = isLocal 
        ? 'Вы уверены, что хотите удалить этот локальный файл? (Он будет навсегда удален с жесткого диска!)' 
        : 'Вы уверены, что хотите удалить этот трек из библиотеки?';
        
      if (!window.confirm(msg)) return;
      deleteTrackCompletely(track);
    }
  };

  const handlePlayTrack = async (track: any) => {
    try {
      await fetch('http://localhost:3001/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          query: track.query,
          type: track.type,
          playlistId: activePlaylistId,
          playlistName: activePlaylistId ? playlists.find(p => p.id === activePlaylistId)?.name : 'Main Library'
        })
      });
    } catch (e) {
      console.error('Failed to play track', e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData
      });
      fetchTracks();
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    try {
      await fetch('http://localhost:3001/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlaylistName })
      });
      setNewPlaylistName('');
      setIsModalOpen(false);
      fetchPlaylists();
    } catch (err) {
      console.error('Failed to create playlist', err);
    }
  };

  const handleAddToPlaylist = async (e: React.MouseEvent, trackId: number, playlistId: number) => {
    e.stopPropagation();
    try {
      await fetch(`http://localhost:3001/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId })
      });
      setActiveMenuId(null);
    } catch (err) {
      console.error('Failed to add track to playlist', err);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const duration = status.currentTrack?.duration || status.duration || 0;
  const elapsed = seekValue !== null ? seekValue : (status.elapsed || 0);

  const filteredTracks = tracks.filter(track => {
    const titleMatch = (track.title || track.name || track.query || '').toLowerCase().includes(searchQuery.toLowerCase());
    const artistMatch = (track.artist || '').toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || artistMatch;
  });

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);
  const playlistName = activePlaylist ? activePlaylist.name : 'All Tracks';

  return (
    <div className={`player-app theme-${theme}`} onClick={() => { setActiveMenuId(null); setMenuView('main'); }}>
      <div className="main-container">
        
        {/* Left Sidebar */}
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

        {/* Center Panel */}
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
                
                {filteredTracks.map((track, index) => {
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
                                  {playlists.map(pl => (
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

        {/* Right Sidebar */}
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
      </div>

      {/* Bottom Bar */}
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
              <input 
                type="range" 
                min="0" max={duration || 100} 
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
          <button style={{background: 'none', border: 'none', padding: 0}} className={rightPanelMode === 'queue' && !rightCollapsed ? 'active-icon' : ''} onClick={() => handleRightToggle('queue')}><ListMusic size={18} /></button>
          <button style={{background: 'none', border: 'none', padding: 0}} className={rightPanelMode === 'info' && !rightCollapsed ? 'active-icon' : ''} onClick={() => handleRightToggle('info')}><Info size={18} /></button>
          <Volume2 size={18} />
          <div className="volume-bar" style={{position: 'relative'}}>
            <input type="range" min="0" max="100" defaultValue="50" style={{position: 'absolute', width: '100%', opacity: 0, cursor: 'pointer', zIndex: 2}} />
            <div className="volume-filled" style={{width: '50%'}}></div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {isModalOpen && (
        <div className="modal-overlay" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'}} onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-light)', minWidth: '300px'}} onClick={e => e.stopPropagation()}>
            <h3 style={{margin: '0 0 16px 0'}}>New Playlist</h3>
            <form onSubmit={handleCreatePlaylist} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input 
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
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Do you want to remove this track from the current playlist, or delete it completely from your library?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
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
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 60, 60, 0.5)', background: 'rgba(255, 60, 60, 0.2)', color: '#ff5555', cursor: 'pointer' }}
              >
                Delete Completely from Library
              </button>
              <button 
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
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
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
    </div>
  );
}




import React, { useEffect, useState } from 'react';
import './App.css';

import homeIcon from './icons/home_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import musicNoteIcon from './icons/music_note_2_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import addIcon from './icons/add_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import uploadIcon from './icons/upload_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import playArrowIcon from './icons/play_arrow_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import playCircleIcon from './icons/play_circle_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import pauseCircleIcon from './icons/pause_circle_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import pauseIcon from './icons/pause_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import shuffleIcon from './icons/shuffle_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import repeatIcon from './icons/repeat_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import skipPrevIcon from './icons/skip_previous_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import skipNextIcon from './icons/skip_next_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import searchIcon from './icons/search_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import filterIcon from './icons/filter_alt_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import moreVertIcon from './icons/more_vert_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import queueListIcon from './icons/format_list_bulleted_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import infoIcon from './icons/info_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import volumeIcon from './icons/volume_up_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import logoutIcon from './icons/logout_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import settingsIcon from './icons/settings_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import deleteIcon from './icons/delete_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';
import addCircleIcon from './icons/add_circle_24dp_999999_FILL0_wght400_GRAD0_opsz24.svg';

const USER_ID = '450362999073406977';

function App() {
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
  const [trackPlaylists, setTrackPlaylists] = useState<string[]>([]); // плейлисты, в которых есть выбранный трек
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<'queue' | 'info'>('queue');

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

  // Загружаем в каких плейлистах находится выбранный трек
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
  }, [selectedTrack]);

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
      await fetch('http://localhost:3001/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          query: newTrackInput,
          type: 'url'
        })
      });
      setNewTrackInput('');
      fetchTracks();
    } catch (e) {
      console.error('Failed to add track', e);
    }
  };

  const handleDeleteTrack = async (e: React.MouseEvent, track: any) => {
    e.stopPropagation();
    const isLocal = track.type === 'local';
    const msg = isLocal 
      ? 'Вы уверены, что хотите удалить этот локальный файл? (Он будет навсегда удален с жесткого диска!)' 
      : 'Вы уверены, что хотите удалить этот трек из библиотеки?';
      
    if (!window.confirm(msg)) return;
    try {
      await fetch(`http://localhost:3001/api/tracks/${track.id}?userId=${USER_ID}`, { method: 'DELETE' });
      fetchTracks();
      if (selectedTrack && selectedTrack.id === track.id) {
        setSelectedTrack(null);
      }
    } catch (e) {
      console.error('Failed to delete track', e);
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
          type: track.type
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
    <div className="app-layout" onClick={() => { setActiveMenuId(null); setMenuView('main'); }}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <form onSubmit={handleAddTrack} className="sidebar-form">
            <input 
              type="text" 
              placeholder="url / name" 
              value={newTrackInput}
              onChange={(e) => setNewTrackInput(e.target.value)}
              className="sidebar-input"
            />
            <button type="submit" className="add-btn">
              <img src={addIcon} className="icon" alt="+" />
            </button>
            <label className="upload-btn" title="Upload File">
              <img src={uploadIcon} className="icon" alt="upload" />
              <input type="file" accept=".mp3,.wav,.ogg" style={{ display: 'none' }} onChange={handleFileUpload} />
            </label>
          </form>
          
          <div 
            className={`nav-item ${activePlaylistId === null ? "active" : ""}`}
            onClick={() => {
              setActivePlaylistId(null);
              fetchTracks(null);
            }}
          >
            <img src={homeIcon} className="icon" alt="home" />
            <span>Home page</span>
          </div>
          
          <div className="sidebar-divider"></div>
        </div>
        
        <div className="sidebar-middle">
          <button className="new-playlist-btn" onClick={() => setIsModalOpen(true)}>
            <img src={addCircleIcon} className="icon" alt="new playlist" />
            New Playlist
          </button>
          
          <div style={{ marginTop: '8px' }}>
            {playlists.map((pl: any) => (
              <div 
                key={pl.id} 
                className={`playlist-item ${activePlaylistId === pl.id ? 'active' : ''}`}
                onClick={() => {
                  setActivePlaylistId(pl.id);
                  fetchTracks(pl.id);
                }}
              >
                <img src={musicNoteIcon} className="icon" alt="playlist" />
                <span>{pl.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="sidebar-bottom">
          <div className="user-info">
            <div className="user-avatar"></div>
            <div className="user-name">{USER_ID}</div>
          </div>
          <div className="user-actions">
            <button className="icon-btn" title="Logout">
              <img src={logoutIcon} className="icon" alt="logout" />
            </button>
            <button className="icon-btn" title="Settings">
              <img src={settingsIcon} className="icon" alt="settings" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <div className="header-cover" style={(tracks.length > 0 && tracks[0].thumbnail) ? { backgroundImage: `url(${tracks[0].thumbnail.startsWith('/') ? 'http://localhost:3001' + tracks[0].thumbnail : tracks[0].thumbnail})` } : {}}></div>
          <div className="header-content">
            <div className="playlist-title">Playlist: {playlistName}</div>
            <div className="playlist-count">{tracks.length} tracks</div>
            <div className="header-spacer"></div>
          </div>
        </header>
        
        <div className="controls-row">
          <div className="controls-left">
            <button className="play-main-btn" onClick={() => {
              if (filteredTracks.length > 0) handlePlayTrack(filteredTracks[0]);
            }}>
              <img src={playArrowIcon} className="icon" alt="play" />
            </button>
            <button className="icon-btn" onClick={() => handleAction('shuffle')}>
              <img src={shuffleIcon} className="icon" alt="shuffle" />
            </button>
            <button className="icon-btn" onClick={() => handleAction('repeat')}>
              <img src={repeatIcon} className="icon" alt="repeat" />
            </button>
          </div>
          <div className="controls-right">
            <button className="icon-btn" onClick={() => setShowSearch(!showSearch)}>
              <img src={searchIcon} className="icon" alt="search" />
            </button>
            <button className="icon-btn">
              <img src={filterIcon} className="icon" alt="filter" />
            </button>
          </div>
        </div>
        
        {showSearch && (
          <div className="search-input-container">
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              autoFocus
            />
          </div>
        )}

        <div className="track-list-container">
          <div className="track-list-header">
            <div style={{ textAlign: 'center' }}>№</div>
            <div>Title</div>
            <div style={{ textAlign: 'right', paddingRight: '16px' }}>Duration</div>
            <div></div>
          </div>

          <div>
            {filteredTracks.map((track, index) => {
              const isCurrentTrack = status.currentTrack && (status.currentTrack.id === track.id || status.currentTrack.query === track.query);
              const isPlaying = isCurrentTrack && status.isPlaying && !status.isPaused;
              const isPaused = isCurrentTrack && status.isPaused;
              
              return (
                <div 
                  key={index} 
                  className={`track-item ${isCurrentTrack ? 'is-active' : ''}`} 
                  onClick={() => {
                    setSelectedTrack(track);
                    handlePlayTrack(track);
                  }}
                >
                  <div className="track-index-col">
                    {isPlaying ? (
                      <div className="equalizer">
                        <div className="eq-bar"></div>
                        <div className="eq-bar"></div>
                        <div className="eq-bar"></div>
                      </div>
                    ) : isPaused ? (
                      <div className="track-paused-icon">
                        <img src={pauseIcon} className="icon" alt="paused" style={{ width: '16px', height: '16px' }} />
                      </div>
                    ) : (
                      <>
                        <span className="track-number">{index + 1}</span>
                        <div className="track-play-icon" onClick={(e) => { e.stopPropagation(); handlePlayTrack(track); }}>
                          <img src={playArrowIcon} className="icon" alt="play" />
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="track-info-col">
                    <div className="track-thumb">
                      {track.thumbnail ? (
                        <img src={track.thumbnail.startsWith('/') ? `http://localhost:3001${track.thumbnail}` : track.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} alt="thumb" />
                      ) : (
                        <img src={musicNoteIcon} className="icon" alt="music" style={{ width: '16px', height: '16px' }} />
                      )}
                    </div>
                    <div className="track-title">{track.title || track.name || track.query || track.url || 'Unknown Track'}</div>
                  </div>
                  
                  <div className="track-duration">{formatTime(track.duration || 0)}</div>
                  
                  <div className="track-menu-col">
                    <button 
                      className="icon-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === track.id ? null : track.id);
                        setMenuView('main');
                      }} 
                    >
                      <img src={moreVertIcon} className="icon" alt="more" />
                    </button>
                    {activeMenuId === track.id && (
                      <div className="dropdown-menu">
                        {menuView === 'main' ? (
                          <>
                            <div 
                              className="dropdown-item"
                              onClick={(e) => { e.stopPropagation(); setMenuView('playlists'); }}
                            >
                              <span>Add to playlist</span>
                              <span style={{ fontSize: '10px' }}>▶</span>
                            </div>
                            <div className="dropdown-separator"></div>
                            <div 
                              className="dropdown-item delete"
                              onClick={(e) => { e.stopPropagation(); handleDeleteTrack(e, track); }}
                            >
                              <span>Delete</span>
                              <img src={deleteIcon} className="icon" alt="delete" style={{ filter: 'brightness(0) invert(1)' }} />
                            </div>
                          </>
                        ) : (
                          <>
                            <div 
                              className="dropdown-item"
                              onClick={(e) => { e.stopPropagation(); setMenuView('main'); }}
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              <span>← Back</span>
                            </div>
                            <div className="dropdown-separator"></div>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                              {playlists.length === 0 && <div className="dropdown-item" style={{ color: 'var(--text-secondary)', cursor: 'default' }}>No playlists</div>}
                              {playlists.map(pl => (
                                <div 
                                  key={pl.id} 
                                  className="dropdown-item"
                                  onClick={(e) => { e.stopPropagation(); handleAddToPlaylist(e, track.id, pl.id); }}
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
      </main>

      {/* Queue or Info Panel */}
      <aside className="queue-area">
        {rightPanelMode === 'queue' ? (
          <>
            <div className="queue-header">Queue: {playlistName}</div>
            <div className="queue-content">
              <div className="queue-section-title">Now playing</div>
              {status.currentTrack ? (
                <div className="queue-track">
                  <div className="queue-track-thumb">
                    {status.currentTrack.thumbnail ? (
                      <img src={status.currentTrack.thumbnail.startsWith('/') ? `http://localhost:3001${status.currentTrack.thumbnail}` : status.currentTrack.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} alt="thumb" />
                    ) : (
                      <img src={musicNoteIcon} className="icon" alt="music" style={{ width: '20px', height: '20px' }} />
                    )}
                  </div>
                  <div className="queue-track-info">
                    <span className="queue-track-title">{status.currentTrack.title || status.currentTrack.query}</span>
                    <span className="queue-track-artist">{status.currentTrack.artist || 'Unknown'}</span>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Empty</div>
              )}
              
              <div className="queue-divider"></div>
              
              <div className="queue-section-title">Next</div>
              {status.queue && status.queue.length > 0 ? (
                status.queue.map((qTrack: any, i: number) => (
                  <div key={i} className="queue-track">
                    <div className="queue-track-thumb">
                      {qTrack.thumbnail ? (
                        <img src={qTrack.thumbnail.startsWith('/') ? `http://localhost:3001${qTrack.thumbnail}` : qTrack.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} alt="thumb" />
                      ) : (
                        <img src={musicNoteIcon} className="icon" alt="music" style={{ width: '20px', height: '20px' }} />
                      )}
                    </div>
                    <div className="queue-track-info">
                      <span className="queue-track-title">{qTrack.title || qTrack.query}</span>
                      <span className="queue-track-artist">{qTrack.artist || 'Unknown'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Queue is empty</div>
              )}
            </div>
          </>
        ) : (
          <div className="info-panel">
            <div className="info-top">
              {selectedTrack ? (
                <>
                  <div className="cover-art-large" style={selectedTrack.thumbnail ? { backgroundImage: `url(${selectedTrack.thumbnail.startsWith('/') ? 'http://localhost:3001' + selectedTrack.thumbnail : selectedTrack.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}></div>
                  <div className="info-title">{selectedTrack.title || selectedTrack.query || selectedTrack.name || 'Unknown'}</div>
                  <div className="info-artist">{selectedTrack.artist || 'Unknown'}</div>
                </>
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Select a track to view info</div>
              )}
            </div>
            {selectedTrack && (
              <>
                <div className="queue-divider" style={{ margin: '0 16px' }}></div>
                <div className="info-bottom">
                  <div>Platform: {selectedTrack.type === 'local' ? 'Local File' : 'YouTube'}</div>
                  {selectedTrack.url && (
                    <div>URL: <a href={selectedTrack.url} target="_blank" rel="noreferrer">Link</a></div>
                  )}
                  <div>Is in: {trackPlaylists.length > 0 ? trackPlaylists.join(', ') : '—'}</div>
                </div>
              </>
            )}
          </div>
        )}
      </aside>

      {/* Player Bar */}
      <footer className="player-bar">
        <div className="player-left">
          {status.currentTrack && (
            <>
              <div className="player-thumb-main">
                {status.currentTrack.thumbnail ? (
                  <img src={status.currentTrack.thumbnail.startsWith('/') ? `http://localhost:3001${status.currentTrack.thumbnail}` : status.currentTrack.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} alt="thumb" />
                ) : (
                  <img src={musicNoteIcon} className="icon" alt="music" />
                )}
              </div>
              <div className="player-track-info">
                <span className="player-track-title">{status.currentTrack.title || status.currentTrack.query}</span>
                <span className="player-track-artist">{status.currentTrack.artist || 'Unknown'}</span>
              </div>
            </>
          )}
        </div>
        
        <div className="player-center">
          <div className="player-controls">
            <button className="icon-btn" onClick={() => handleAction('shuffle')}>
              <img src={shuffleIcon} className={`icon ${status.shuffle ? 'active' : ''}`} alt="shuffle" title="Shuffle" />
            </button>
            <button className="icon-btn" onClick={() => handleAction('previous')}>
              <img src={skipPrevIcon} className="icon" alt="prev" />
            </button>
            
            <button className="play-circle-btn" onClick={() => {
              if (status.isPlaying && !status.isPaused) handleAction('pause');
              else if (status.currentTrack) handleAction('resume');
            }}>
              <img src={status.isPlaying && !status.isPaused ? pauseCircleIcon : playCircleIcon} className="icon" alt="play/pause" />
            </button>
            
            <button className="icon-btn" onClick={() => handleAction('skip', { direction: 1 })}>
              <img src={skipNextIcon} className="icon" alt="next" />
            </button>
            <button className="icon-btn" onClick={() => handleAction('repeat')} style={{ position: 'relative' }}>
              <img src={repeatIcon} className={`icon ${status.repeatMode !== 'off' ? 'active' : ''}`} alt="repeat" title="Repeat" />
              {status.repeatMode === 'track' && (
                <span style={{ position: 'absolute', top: 2, right: 2, fontSize: '10px', fontWeight: 'bold', color: '#fff', background: 'var(--accent)', borderRadius: '50%', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
              )}
            </button>
          </div>
          
          <div className="progress-container">
            <span>{formatTime(elapsed)}</span>
            <input 
              type="range" 
              min="0" max={duration || 100} 
              value={elapsed} 
              onChange={(e) => setSeekValue(Number(e.target.value))}
              onMouseUp={(e) => {
                handleAction('seek', { seconds: Number(e.currentTarget.value) });
                setSeekValue(null);
              }}
              className="progress-slider"
              disabled={!duration}
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        
        <div className="player-right">
          <button 
            className="icon-btn"
            onClick={() => setRightPanelMode('queue')}
          >
            <img src={queueListIcon} className={`icon ${rightPanelMode === 'queue' ? 'active' : ''}`} alt="queue" />
          </button>
          <button 
            className="icon-btn"
            onClick={() => setRightPanelMode('info')}
          >
            <img src={infoIcon} className={`icon ${rightPanelMode === 'info' ? 'active' : ''}`} alt="info" />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px' }}>
            <img src={volumeIcon} className="icon active" alt="volume" style={{ width: '18px', height: '18px' }} />
            <input type="range" min="0" max="100" defaultValue="50" className="volume-slider" />
          </div>
        </div>
      </footer>

      {/* Create Playlist Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>New Playlist</h3>
            <form onSubmit={handleCreatePlaylist} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input 
                type="text" 
                autoFocus
                placeholder="Playlist name..." 
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="modal-input"
              />
              <div className="modal-buttons">
                <button type="button" className="modal-btn cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="modal-btn create">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

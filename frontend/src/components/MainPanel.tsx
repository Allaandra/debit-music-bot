import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, ListMusic, Info, Search, Filter, Trash2, MoreVertical, Music, BarChart2, Home, Plus, Upload, Settings, LogOut, Palette, ChevronLeft, ChevronRight } from 'lucide-react';


const HoverScroller = ({ text, className, style }: any) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const [overflowAmount, setOverflowAmount] = React.useState(0);

  React.useEffect(() => {
    const check = () => {
      if (containerRef.current && textRef.current) {
        const over = textRef.current.scrollWidth - containerRef.current.clientWidth;
        setOverflowAmount(over > 0 ? over : 0);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [text]);

  const shouldAnimate = isHovered && overflowAmount > 0;

  return (
    <div 
      ref={containerRef} 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', minWidth: 0 }}
    >
      <div 
        ref={textRef} 
        className={className} 
        style={{ 
          ...style,
          display: shouldAnimate ? 'inline-block' : 'block', 
          whiteSpace: 'nowrap',
          overflow: shouldAnimate ? 'visible' : 'hidden',
          textOverflow: shouldAnimate ? 'clip' : 'ellipsis',
          transition: shouldAnimate ? `transform ${overflowAmount * 0.04}s linear 0.3s` : 'transform 0.3s ease',
          transform: shouldAnimate ? `translateX(-${overflowAmount + 20}px)` : 'translateX(0)',
        }}
      >
        {text}
      </div>
    </div>
  );
};

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
      USER_ID, duration, elapsed, filteredTracks, playlistName, sortMethod, setSortMethod
  } = player;

  React.useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuId(null);
    };
    if (activeMenuId !== null) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activeMenuId, setActiveMenuId]);

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
              <span className="track-count">
                {(() => {
                  if (!activePlaylistId) return "Home";
                  const p = playlists.find((pl: any) => pl.id === activePlaylistId);
                  if (p && p.createdAt) {
                    const d = new Date(p.createdAt);
                    return "Created " + d.toLocaleString("en-US", { month: "short", year: "numeric" });
                  }
                  return "Created Date Unknown";
                })()}
              </span>
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
                
                <div className="controls-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {showSearch && (
                    <input 
                      type="text" 
                      className="search-input"
                      placeholder="Search..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ padding: '6px 12px', height: '32px', minWidth: '200px' }}
                      autoFocus
                    />
                  )}
                  <button className="icon-btn" style={{background: 'none', border: 'none', padding: 0}} onClick={() => setShowSearch(!showSearch)}>
                    <Search size={20} color={showSearch ? "var(--accent)" : "var(--text-muted)"} />
                  </button>
                  
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <button 
                      className="icon-btn" 
                      style={{background: 'none', border: 'none', padding: 0}} 
                      onClick={() => {
                        const nextSort = sortMethod === 'default' ? 'name' : sortMethod === 'name' ? 'duration' : sortMethod === 'duration' ? 'author' : 'default';
                        setSortMethod(nextSort);
                      }}
                      title="Sort by"
                    >
                      <Filter size={20} color={sortMethod !== 'default' ? "var(--accent)" : "var(--text-muted)"} />
                    </button>
                    {sortMethod !== 'default' && (
                      <span style={{ position: 'absolute', top: -12, right: -8, fontSize: '10px', color: 'var(--text-primary)', background: 'var(--accent)', padding: '2px 4px', borderRadius: '4px', pointerEvents: 'none' }}>
                        {sortMethod}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="track-list">
                <div className="track-row track-header">
                  <div className="track-num" style={{textAlign: 'center'}}>№</div>
                  <div className="track-title-col">Title</div>
                  <div className="track-author-col">Author</div>
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
                        if (isCurrentTrack && isPlaying) {
                          handleAction('pause');
                        } else if (isCurrentTrack && isPaused) {
                          handleAction('resume');
                        } else {
                          setSelectedTrack(track);
                          handlePlayTrack(track);
                        }
                      }}
                    >
                      <div className="track-num">
                        {isPlaying ? (
                          <>
                            <div className="icon-playing animated-eq">
                              <span></span><span></span><span></span>
                            </div>
                            <Pause size={16} fill="currentColor" className="icon-pause-hover" />
                          </>
                        ) : (
                          <>
                            <span className="track-number">{isPaused ? index + 1 : index + 1}</span>
                            <Play size={16} fill="currentColor" className="icon-play-hover" />
                          </>
                        )}
                      </div>
                      <div className="track-title-col">
                        <div className="track-icon" style={{ position: 'relative' }}>
                          {track.thumbnail ? (
                            <img src={track.thumbnail.startsWith('/') ? `http://localhost:3001${track.thumbnail}` : track.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} alt="thumb" />
                          ) : (
                            <div className="art-placeholder" style={{ borderRadius: '4px' }}></div>
                          )}

                                                </div>
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingRight: '8px', minWidth: 0, width: '100%' }}>
                          <HoverScroller text={track.title || track.name || track.query || track.url || 'Unknown Track'} className="track-name" />
                        </div>
                      </div>
                      <div className="track-author-col">
                        <HoverScroller text={track.artist || 'Unknown Artist'} />
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
                          }} onClick={(e) => e.stopPropagation()}>
                            {menuView === 'main' ? (
                              <>
                                <div 
                                  className="dropdown-item"
                                  onClick={(e) => { e.stopPropagation(); setMenuView('playlists'); }}
                                  style={{ justifyContent: 'space-between' }}
                                >
                                  <span>Add to playlist</span>
                                  <span style={{ fontSize: '10px', marginTop: '4px' }}>▶</span>
                                </div>
                                <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }}></div>
                                <div 
                                  className="dropdown-item"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteTrack(e, track); }}
                                  style={{ color: '#ff5555', justifyContent: 'space-between' }}
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
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  <span>← Back</span>
                                </div>
                                <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }}></div>
                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                  {playlists.length === 0 && <div style={{ padding: '8px 16px', color: 'var(--text-muted)', fontSize: '14px' }}>No playlists</div>}
                                  {playlists.map((pl: any) => (
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
          </div>
        </main>
    </>
  );
};






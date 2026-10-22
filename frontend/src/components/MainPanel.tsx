import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { resolveMediaUrl, api } from '../services/api';
import { Play, Pause, Shuffle, Repeat, Search, Filter, Trash2, MoreVertical, ChevronRight, RefreshCw } from 'lucide-react';


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
  const [isSyncing, setIsSyncing] = React.useState(false);
  const {
    status,
    tracks,
    playlists,
    activeMenuId,
    setActiveMenuId,
    menuView,
    setMenuView,
    activePlaylistId,
    setSelectedTrack,
    searchQuery,
    setSearchQuery,
    showSearch,
    setShowSearch,
    fetchTracks,
    fetchPlaylists,
    handleAction,
    handleDeleteTrack,
    handlePlayTrack,
    handleAddToPlaylist,
    formatTime,
    filteredTracks,
    playlistName,
    sortMethod,
    setSortMethod
  } = usePlayer();

  const handleSyncSounds = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await api.syncSounds();
      await Promise.all([fetchTracks(), fetchPlaylists()]);
    } catch (e) {
      console.error('Failed to sync sounds:', e);
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

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
                  const p = (Array.isArray(playlists) ? playlists : []).find((pl: any) => pl.id === activePlaylistId);
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
                    <input id="main-search-input" name="mainSearchInput" type="text" className="search-input"
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

                  <button
                    className={`icon-btn ${isSyncing ? 'spin-anim' : ''}`}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: isSyncing ? 'default' : 'pointer' }}
                    onClick={handleSyncSounds}
                    title={isSyncing ? 'Сканирование файлов...' : 'Принудительный скан локальных файлов (sounds/)'}
                  >
                    <RefreshCw size={19} color={isSyncing ? 'var(--accent)' : 'var(--text-muted)'} />
                  </button>
                </div>
              </div>
              
              <div className="track-list">
                <div className="track-row track-header">
                  <div className="track-num" style={{textAlign: 'center'}}>#</div>
                  <div className="track-title-col" style={{ cursor: 'pointer' }} onClick={() => setSortMethod(sortMethod === 'name' ? 'default' : 'name')}><span style={{ padding: '4px 8px', borderRadius: '6px', background: sortMethod === 'name' ? 'rgba(0,0,0,0.3)' : 'transparent', color: sortMethod === 'name' ? 'var(--accent)' : 'inherit', transition: 'all 0.2s' }}>Title</span></div>
                  <div className="track-author-col" style={{ cursor: 'pointer' }} onClick={() => setSortMethod(sortMethod === 'author' ? 'default' : 'author')}><span style={{ padding: '4px 8px', borderRadius: '6px', background: sortMethod === 'author' ? 'rgba(0,0,0,0.3)' : 'transparent', color: sortMethod === 'author' ? 'var(--accent)' : 'inherit', transition: 'all 0.2s' }}>Author</span></div>
                  <div className="track-duration-col" style={{ cursor: 'pointer', justifyContent: 'flex-end' }} onClick={() => setSortMethod(sortMethod === 'duration' ? 'default' : 'duration')}><span style={{ padding: '4px 8px', borderRadius: '6px', background: sortMethod === 'duration' ? 'rgba(0,0,0,0.3)' : 'transparent', color: sortMethod === 'duration' ? 'var(--accent)' : 'inherit', transition: 'all 0.2s' }}>Duration</span></div>
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
                            <img src={resolveMediaUrl(track.thumbnail)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} alt="thumb" />
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
                            background: 'var(--glass-bg)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                            border: '1px solid var(--border-light)', borderRadius: '8px',
                            minWidth: '150px', padding: '4px',
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
                                  <ChevronRight size={14} />
                                </div>
                                <div 
                                  className="dropdown-item danger"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteTrack(e, track); }}
                                  style={{ justifyContent: 'space-between' }}
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
                                <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '2px 4px' }}></div>
                                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  {playlists.length === 0 && <div style={{ padding: '7px 10px', color: 'var(--text-muted)', fontSize: '12px' }}>No playlists</div>}
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













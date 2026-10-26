import React from 'react';
import { usePlayer, usePlaybackProgress } from '../context/PlayerContext';
import { resolveMediaUrl } from '../services/api';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX, ListMusic, Info, Swords, Music } from 'lucide-react';

export const PlayerBar = () => {
  const player = usePlayer();
  const {
    status,
    rightPanelMode,
    rightCollapsed,
    handleAction,
    handleRightToggle
  } = player;
  const { elapsed, duration, setSeekValue, formatTime } = usePlaybackProgress();

  const lastNonZeroVolume = React.useRef(player.musicVolume > 0 ? player.musicVolume : 0.8);
  React.useEffect(() => {
    if (player.musicVolume > 0) {
      lastNonZeroVolume.current = player.musicVolume;
    }
  }, [player.musicVolume]);

  const toggleMute = () => {
    if (player.musicVolume > 0) {
      lastNonZeroVolume.current = player.musicVolume;
      player.handleVolumeChange(0, true);
    } else {
      player.handleVolumeChange(lastNonZeroVolume.current || 0.8, true);
    }
  };

  return (
    <>
      <footer className="bottom-bar">
        <div className="now-playing-left">
          {status.currentTrack && (
            <>
              <div className="track-icon-lg">
                {status.currentTrack.thumbnail ? (
                  <img src={resolveMediaUrl(status.currentTrack.thumbnail)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} alt="thumb" />
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
                onTouchEnd={(e) => {
                  handleAction('seek', { seconds: Number(e.currentTarget.value) });
                  setSeekValue(null);
                }}
                onKeyUp={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    handleAction('seek', { seconds: Number(e.currentTarget.value) });
                    setSeekValue(null);
                  }
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
          <button style={{background: 'none', border: 'none', padding: 0}} title="Sound Effects (SFX)" className={rightPanelMode === 'sfx' && !rightCollapsed ? 'active-icon' : ''} onClick={() => handleRightToggle('sfx')}><Swords size={18} /></button>
          <button style={{background: 'none', border: 'none', padding: 0}} title="Queue" className={rightPanelMode === 'queue' && !rightCollapsed ? 'active-icon' : ''} onClick={() => handleRightToggle('queue')}><ListMusic size={18} /></button>
          <button style={{background: 'none', border: 'none', padding: 0}} title="Track Info" className={rightPanelMode === 'info' && !rightCollapsed ? 'active-icon' : ''} onClick={() => handleRightToggle('info')}><Info size={18} /></button>
          
          {/* SFX Volume slider */}
          <div className="volume-control-group" title={`SFX Volume: ${Math.round((player.sfxVolume ?? 0.8) * 100)}%`}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', cursor: 'default' }}>SFX</span>
            <div className="volume-bar" style={{ position: 'relative', width: '70px' }}>
              <input
                id="sfx-volume-bar"
                name="sfxVolumeBar"
                type="range"
                min="0"
                max="200"
                value={Math.round((player.sfxVolume ?? 0.8) * 100)}
                onChange={(e) => player.setSfxVolume(Number(e.target.value) / 100)}
                style={{ position: 'absolute', width: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }}
              />
              <div className="volume-filled" style={{ width: `${Math.min(100, Math.round(((player.sfxVolume ?? 0.8) * 100) / 2))}%` }}></div>
            </div>
          </div>

          {/* Music Volume slider */}
          <div className="volume-control-group" title={`Music Volume: ${Math.round((player.musicVolume ?? 0.8) * 100)}%`}>
            <button
              style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'inherit' }}
              onClick={toggleMute}
              title={player.musicVolume > 0 ? "Mute" : "Unmute"}
            >
              {player.musicVolume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} color="var(--accent)" />}
            </button>
            <div className="volume-bar" style={{position: 'relative', width: '70px'}}>
              <input
                id="volume-bar"
                name="volumeBar"
                type="range"
                min="0"
                max="100"
                value={Math.round((player.musicVolume ?? 0.8) * 100)}
                onChange={(e) => player.handleVolumeChange(Number(e.target.value) / 100)}
                style={{ position: 'absolute', width: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }}
              />
              <div className="volume-filled" style={{ width: `${Math.min(100, Math.round((player.musicVolume ?? 0.8) * 100))}%` }}></div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};


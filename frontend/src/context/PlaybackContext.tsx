/* oxlint-disable react/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { PlayerStatus, Track } from '../types';
import { api, SOCKET_URL } from '../services/api';

export interface PlaybackContextValue {
  status: PlayerStatus;
  setStatus: React.Dispatch<React.SetStateAction<PlayerStatus>>;
  seekValue: number | null;
  setSeekValue: (val: number | null) => void;
  guildId: string | null;
  sfxVolume: number;
  setSfxVolume: (vol: number) => void;
  musicVolume: number;
  setMusicVolume: (vol: number) => void;
  handleVolumeChange: (vol: number, immediate?: boolean) => void;
  duration: number;
  elapsed: number;
  formatTime: (seconds: number) => string;
  fetchStatus: () => Promise<void>;
  handleAction: (action: string, payload?: any) => Promise<void>;
  handlePlayTrack: (track: Track, playlistId?: number | null, playlistName?: string) => Promise<void>;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export const usePlayback = (): PlaybackContextValue => {
  const context = useContext(PlaybackContext);
  if (!context) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return context;
};

export interface PlaybackProgressContextValue {
  elapsed: number;
  duration: number;
  seekValue: number | null;
  setSeekValue: (val: number | null) => void;
  formatTime: (seconds: number) => string;
}

const PlaybackProgressContext = createContext<PlaybackProgressContextValue | null>(null);

export const usePlaybackProgress = (): PlaybackProgressContextValue => {
  const context = useContext(PlaybackProgressContext);
  if (!context) {
    throw new Error('usePlaybackProgress must be used within a PlaybackProvider');
  }
  return context;
};

const formatTimeHelper = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const PlaybackProgressProvider: React.FC<{
  status: PlayerStatus;
  syncVersion: number;
  children: React.ReactNode;
}> = ({ status, syncVersion, children }) => {
  const statusSyncKey = `${status.currentTrack?.query ?? ''}:${status.elapsed ?? 0}:${status.isPlaying}:${status.isPaused}:${syncVersion}`;
  const [tickState, setTickState] = useState<{ key: string; bonusSeconds: number }>({
    key: statusSyncKey,
    bonusSeconds: 0
  });
  const [seekValue, setSeekValue] = useState<number | null>(null);

  // Smooth local 1s timer isolated in PlaybackProgressProvider so the rest of the app never re-renders
  useEffect(() => {
    if (!status.isPlaying || status.isPaused) return;

    const timer = setInterval(() => {
      setTickState(prev => ({
        key: statusSyncKey,
        bonusSeconds: (prev.key === statusSyncKey ? prev.bonusSeconds : 0) + 1
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [status.isPlaying, status.isPaused, statusSyncKey]);

  const duration = status.currentTrack?.duration || status.duration || 0;
  const baseElapsed = status.elapsed || 0;
  const bonusSeconds = tickState.key === statusSyncKey ? tickState.bonusSeconds : 0;
  const liveElapsed = duration > 0 ? Math.min(baseElapsed + bonusSeconds, duration) : baseElapsed + bonusSeconds;
  const elapsed = seekValue !== null ? seekValue : liveElapsed;

  return (
    <PlaybackProgressContext.Provider
      value={{
        elapsed,
        duration,
        seekValue,
        setSeekValue,
        formatTime: formatTimeHelper
      }}
    >
      {children}
    </PlaybackProgressContext.Provider>
  );
};

export const PlaybackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<PlayerStatus>({
    currentTrack: null,
    elapsed: 0,
    isPlaying: false,
    isPaused: false,
    duration: 0,
    queue: []
  });

  const [seekValue, setSeekValue] = useState<number | null>(null);
  const [syncVersion, setSyncVersion] = useState<number>(0);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [sfxVolume, setSfxVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem('sfxVolume');
    return saved !== null && !isNaN(Number(saved)) ? Number(saved) : 0.8;
  });
  const [musicVolume, setMusicVolume] = useState<number>(() => {
    const saved = localStorage.getItem('musicVolume');
    return saved !== null && !isNaN(Number(saved)) ? Number(saved) : 0.8;
  });
  const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sfxVolumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const guildIdRef = useRef<string | null>(null);

  useEffect(() => {
    guildIdRef.current = guildId;
  }, [guildId]);

  useEffect(() => {
    localStorage.setItem('sfxVolume', sfxVolume.toString());
  }, [sfxVolume]);

  useEffect(() => {
    localStorage.setItem('musicVolume', musicVolume.toString());
  }, [musicVolume]);

  useEffect(() => {
    const savedMusic = localStorage.getItem('musicVolume');
    const savedSfx = localStorage.getItem('sfxVolume');
    if (savedMusic !== null && !isNaN(Number(savedMusic))) {
      api.action('volume', { volume: Number(savedMusic) }).catch(() => {});
    }
    if (savedSfx !== null && !isNaN(Number(savedSfx))) {
      api.action('sfxVolume', { volume: Number(savedSfx) }).catch(() => {});
    }
    return () => {
      if (volumeDebounceRef.current) {
        clearTimeout(volumeDebounceRef.current);
      }
      if (sfxVolumeDebounceRef.current) {
        clearTimeout(sfxVolumeDebounceRef.current);
      }
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.fetchStatus();
      if (data) {
        setSyncVersion(v => v + 1);
        setStatus(prev => ({
          ...prev,
          ...data,
          currentTrack: data.currentTrack ?? null,
          queue: data.queue || []
        }));
        if (data.guildId) {
          setGuildId(data.guildId);
        }
        if (typeof data.volume === 'number') {
          setMusicVolume(data.volume);
        }
      }
    } catch (e) {
      console.error('Failed to fetch status', e);
    }
  }, []);

  // Socket.IO lifecycle
  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (guildIdRef.current) {
        socket.emit('subscribe', guildIdRef.current);
      }
    });

    socket.on('stateUpdate', (newState: Partial<PlayerStatus> & { guildId?: string }) => {
      if (!newState) return;
      setSyncVersion(v => v + 1);
      setStatus(prev => ({
        ...prev,
        ...newState,
        currentTrack: 'currentTrack' in newState ? (newState.currentTrack ?? null) : prev.currentTrack,
        queue: newState.queue || prev.queue || []
      }));
      if (newState.guildId) {
        setGuildId(newState.guildId);
      }
      if (typeof newState.volume === 'number') {
        setMusicVolume(newState.volume);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Room subscription
  useEffect(() => {
    if (guildId && socketRef.current?.connected) {
      socketRef.current.emit('subscribe', guildId);
    }
  }, [guildId]);

  // Initial fetch and 15s fallback sync
  useEffect(() => {
    const initialTimer = setTimeout(fetchStatus, 0);

    const interval = setInterval(fetchStatus, 15000);
    const onFocus = () => fetchStatus();
    window.addEventListener('focus', onFocus);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchStatus]);

  const handleAction = useCallback(async (action: string, payload?: any) => {
    if (action === 'seek' && payload?.seconds !== undefined) {
      const targetSec = Number(payload.seconds);
      if (!isNaN(targetSec)) {
        setStatus(prev => ({ ...prev, elapsed: targetSec }));
      }
    } else if (action === 'skip') {
      setSyncVersion(v => v + 1);
      setStatus(prev => {
        if (!prev.queue || prev.queue.length === 0) return prev;
        const next = prev.queue[0];
        return {
          ...prev,
          currentTrack: next,
          elapsed: 0,
          isPlaying: true,
          isPaused: false,
          queue: prev.queue.slice(1)
        };
      });
    }
    try {
      const res = await api.action(action, payload);
      if (res?.state) {
        setSyncVersion(v => v + 1);
        setStatus(prev => ({
          ...prev,
          ...res.state,
          currentTrack: 'currentTrack' in res.state ? (res.state.currentTrack ?? null) : prev.currentTrack,
          queue: res.state.queue || []
        }));
        if (typeof res.state.volume === 'number') {
          setMusicVolume(res.state.volume);
        }
      }
      if (res?.guildId) {
        setGuildId(res.guildId);
      }
    } catch (e) {
      console.error(`Failed to execute action ${action}`, e);
    }
  }, []);

  const setSfxVolume = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(2, Math.round(newVol * 100) / 100));
    setSfxVolumeState(clamped);
    if (sfxVolumeDebounceRef.current) {
      clearTimeout(sfxVolumeDebounceRef.current);
    }
    sfxVolumeDebounceRef.current = setTimeout(() => {
      api.action('sfxVolume', { volume: clamped }).catch(() => {});
    }, 40);
  }, []);

  const handleVolumeChange = useCallback((newVol: number, immediate = false) => {
    const clamped = Math.max(0, Math.min(2, Math.round(newVol * 100) / 100));
    setMusicVolume(clamped);
    setStatus(prev => ({ ...prev, volume: clamped }));
    if (volumeDebounceRef.current) {
      clearTimeout(volumeDebounceRef.current);
    }
    if (immediate) {
      handleAction('volume', { volume: clamped });
    } else {
      volumeDebounceRef.current = setTimeout(() => {
        handleAction('volume', { volume: clamped });
      }, 40);
    }
  }, [handleAction]);

  const handlePlayTrack = useCallback(async (track: Track, playlistId?: number | null, playlistName?: string) => {
    // Optimistically reflect selected track as currentTrack at 0:00 while waiting for stream to prebuffer
    setSyncVersion(v => v + 1);
    setStatus(prev => ({
      ...prev,
      currentTrack: track,
      elapsed: 0,
      isPlaying: false,
      isPaused: false
    }));
    try {
      const res = await api.playTrack(track, playlistId ?? null, playlistName || 'Main Library');
      if (res?.guildId) {
        setGuildId(res.guildId);
      }
      if (res?.state) {
        setSyncVersion(v => v + 1);
        setStatus(prev => ({
          ...prev,
          ...res.state,
          currentTrack: res.state.currentTrack ?? null,
          queue: res.state.queue || []
        }));
      }
    } catch (e) {
      console.error('Failed to play track', e);
      fetchStatus();
    }
  }, [fetchStatus]);

  const duration = status.currentTrack?.duration || status.duration || 0;
  const elapsed = seekValue !== null ? seekValue : (status.elapsed || 0);

  return (
    <PlaybackContext.Provider
      value={{
        status,
        setStatus,
        seekValue,
        setSeekValue,
        guildId,
        sfxVolume,
        setSfxVolume,
        musicVolume,
        setMusicVolume,
        handleVolumeChange,
        duration,
        elapsed,
        formatTime: formatTimeHelper,
        fetchStatus,
        handleAction,
        handlePlayTrack
      }}
    >
      <PlaybackProgressProvider status={status} syncVersion={syncVersion}>
        {children}
      </PlaybackProgressProvider>
    </PlaybackContext.Provider>
  );
};

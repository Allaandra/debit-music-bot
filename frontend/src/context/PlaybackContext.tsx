import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  const [guildId, setGuildId] = useState<string | null>(null);
  const [sfxVolume, setSfxVolume] = useState<number>(() => {
    const saved = localStorage.getItem('sfxVolume');
    return saved !== null && !isNaN(Number(saved)) ? Number(saved) : 0.8;
  });

  const socketRef = useRef<Socket | null>(null);
  const guildIdRef = useRef<string | null>(null);

  useEffect(() => {
    guildIdRef.current = guildId;
  }, [guildId]);

  useEffect(() => {
    localStorage.setItem('sfxVolume', sfxVolume.toString());
  }, [sfxVolume]);

  const fetchStatus = async () => {
    try {
      const data = await api.fetchStatus();
      if (data) {
        setStatus(prev => ({ ...prev, ...data, queue: data.queue || [] }));
        if (data.guildId) {
          setGuildId(data.guildId);
        }
      }
    } catch (e) {
      console.error('Failed to fetch status', e);
    }
  };

  // Socket.IO lifecycle
  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected to server');
      if (guildIdRef.current) {
        socket.emit('subscribe', guildIdRef.current);
      }
    });

    socket.on('stateUpdate', (newState: Partial<PlayerStatus> & { guildId?: string }) => {
      if (!newState) return;
      setStatus(prev => ({
        ...prev,
        ...newState,
        queue: newState.queue || prev.queue || []
      }));
      if (newState.guildId) {
        setGuildId(newState.guildId);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
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

  // Smooth local playback progress timer
  useEffect(() => {
    if (!status.isPlaying || status.isPaused) return;

    const timer = setInterval(() => {
      setStatus(prev => {
        if (!prev.isPlaying || prev.isPaused) return prev;
        const trackDuration = prev.currentTrack?.duration || prev.duration || 0;
        const currentElapsed = prev.elapsed || 0;
        if (trackDuration > 0 && currentElapsed >= trackDuration) {
          return prev;
        }
        return {
          ...prev,
          elapsed: currentElapsed + 1
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status.isPlaying, status.isPaused]);

  // Initial fetch and 15s fallback sync
  useEffect(() => {
    fetchStatus();

    const interval = setInterval(fetchStatus, 15000);
    const onFocus = () => fetchStatus();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const handleAction = async (action: string, payload?: any) => {
    try {
      const res = await api.action(action, payload);
      if (res?.state) {
        setStatus(prev => ({
          ...prev,
          ...res.state,
          queue: res.state.queue || []
        }));
      }
      if (res?.guildId) {
        setGuildId(res.guildId);
      }
    } catch (e) {
      console.error(`Failed to execute action ${action}`, e);
    }
  };

  const handlePlayTrack = async (track: Track, playlistId?: number | null, playlistName?: string) => {
    try {
      const res = await api.playTrack(track, playlistId ?? null, playlistName || 'Main Library');
      if (res?.guildId) {
        setGuildId(res.guildId);
      }
      if (res?.state) {
        setStatus(prev => ({
          ...prev,
          ...res.state,
          queue: res.state.queue || []
        }));
      }
    } catch (e) {
      console.error('Failed to play track', e);
    }
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

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
        duration,
        elapsed,
        formatTime,
        fetchStatus,
        handleAction,
        handlePlayTrack
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
};

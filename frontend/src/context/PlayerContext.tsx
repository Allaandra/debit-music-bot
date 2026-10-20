import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { api } from '../services/api';

export const PlayerContext = createContext<any>(null);

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<any>({
    currentTrack: null,
    elapsed: 0,
    isPlaying: false,
    duration: 0,
    queue: []
  });
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    api.fetchMe().then(data => {
      if (data && !data.error) setUser(data);
      setLoadingUser(false);
    }).catch(e => {
      console.error(e);
      setLoadingUser(false);
    });
  }, []);

  const [tracks, setTracks] = useState<any[]>([]);
  const [newTrackInput, setNewTrackInput] = useState('');
  const [seekValue, setSeekValue] = useState<number | null>(null);

  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuView, setMenuView] = useState<'main' | 'playlists'>('main');
  const [activePlaylistId, setActivePlaylistId] = useState<number | null>(() => {
    const saved = localStorage.getItem('activePlaylistId');
    return saved && saved !== 'undefined' ? JSON.parse(saved) : null;
  });
  
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [trackPlaylists, setTrackPlaylists] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<'queue' | 'info' | 'sfx'>(() => {
    return (localStorage.getItem('rightPanelMode') as 'queue' | 'info' | 'sfx') || 'queue';
  });
  const [importPlaylistModal, setImportPlaylistModal] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [deleteTrackModal, setDeleteTrackModal] = useState<any>(null);
  const [deletePlaylistModal, setDeletePlaylistModal] = useState<any>(null);
  const [editPlaylistModal, setEditPlaylistModal] = useState<any>(null);

  // Layout states
  const [rightCollapsed, setRightCollapsed] = useState(() => {
    const saved = localStorage.getItem('rightCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [theme, setTheme] = useState<'forest' | 'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'forest' | 'dark' | 'light') || 'forest';
  });
  const [leftCollapsed, setLeftCollapsed] = useState(() => {
    const saved = localStorage.getItem('leftCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [sortMethod, setSortMethod] = useState<'default'|'name'|'duration'|'author'>(() => {
    return (localStorage.getItem('sortMethod') as 'default'|'name'|'duration'|'author') || 'default';
  });

  const [sfxVolume, setSfxVolume] = useState<number>(() => {
    const saved = localStorage.getItem('sfxVolume');
    return saved !== null && !isNaN(Number(saved)) ? Number(saved) : 0.8;
  });

  useEffect(() => { localStorage.setItem('activePlaylistId', JSON.stringify(activePlaylistId)); }, [activePlaylistId]);
  useEffect(() => { localStorage.setItem('rightPanelMode', rightPanelMode); }, [rightPanelMode]);
  useEffect(() => { localStorage.setItem('rightCollapsed', JSON.stringify(rightCollapsed)); }, [rightCollapsed]);
  useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('leftCollapsed', JSON.stringify(leftCollapsed)); }, [leftCollapsed]);
  useEffect(() => { localStorage.setItem('sortMethod', sortMethod); }, [sortMethod]);
  useEffect(() => { localStorage.setItem('sfxVolume', sfxVolume.toString()); }, [sfxVolume]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'forest' ? 'dark' : prev === 'dark' ? 'light' : 'forest');
  };

  const handleRightToggle = (view: 'queue' | 'info' | 'sfx') => {
    if (rightPanelMode === view && !rightCollapsed) {
      setRightCollapsed(true);
    } else {
      setRightPanelMode(view);
      setRightCollapsed(false);
    }
  };

  const fetchTracks = async (playlistId: number | null = activePlaylistId) => {
    try {
      const data = await api.fetchTracks(playlistId);
      setTracks(Array.isArray(data) ? data : (data.tracks || []));
    } catch (e) {
      console.error('Failed to fetch tracks', e);
    }
  };

  const fetchPlaylists = async () => {
    try {
      const data = await api.fetchPlaylists();
      setPlaylists(data);
    } catch (e) {
      console.error('Failed to fetch playlists', e);
      setPlaylists([]);
    }
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.fetchStatus();
        if (data) {
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
    if (status.currentTrack) {
      const matchingTrack = (Array.isArray(tracks) ? tracks : []).find((t: any) => t.query === status.currentTrack.query);
      if (matchingTrack) {
        setSelectedTrack({ ...matchingTrack, ...status.currentTrack });
      } else {
        setSelectedTrack(status.currentTrack);
      }
    }
  }, [status.currentTrack?.query, tracks]);

  useEffect(() => {
    if (!selectedTrack || playlists.length === 0) { setTrackPlaylists([]); return; }
    api.checkTrackInPlaylists(selectedTrack.id, Array.isArray(playlists) ? playlists : [])
      .then(results => setTrackPlaylists(results));
  }, [selectedTrack, playlists]);

  const handleAction = async (action: string, payload?: any) => {
    try {
      await api.action(action, payload);
    } catch (e) {
      console.error(`Failed to execute action ${action}`, e);
    }
  };

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrackInput) return;
    try {
      const data = await api.addTrack(newTrackInput);
      
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
      await api.importPlaylist(importPlaylistModal.query, createPlaylist, importPlaylistModal.title);
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
      await api.deleteTrackCompletely(track.id);
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
      await api.deleteTrackFromPlaylist(activePlaylistId, track.id);
      fetchTracks();
      setDeleteTrackModal(null);
    } catch (e) {
      console.error('Failed to remove from playlist', e);
    }
  };

  const deletePlaylist = async (playlistId: number, deleteTracks: boolean) => {
    try {
      await api.deletePlaylist(playlistId, deleteTracks);
      if (activePlaylistId === playlistId) {
        setActivePlaylistId(null);
        fetchTracks(null);
      }
      fetchPlaylists();
      setDeletePlaylistModal(null);
    } catch (e) {
      console.error('Failed to delete playlist', e);
    }
  };

  const editPlaylist = async (playlistId: number, name?: string, icon?: string) => {
    try {
       await api.editPlaylist(playlistId, { name, icon });
       fetchPlaylists();
       if (activePlaylistId === playlistId) fetchTracks(playlistId);
       setEditPlaylistModal(null);
    } catch (e) {
       console.error('Failed to edit playlist', e);
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
        ? 'Вы уверены, что хотите удалить этот локальный файл? (Он будет навсегда удалён с жёсткого диска!)' 
        : 'Вы уверены, что хотите удалить этот трек из библиотеки?';
        
      if (!window.confirm(msg)) return;
      deleteTrackCompletely(track);
    }
  };

  const handlePlayTrack = async (track: any) => {
    try {
      const currentPlaylistName = activePlaylistId
        ? (Array.isArray(playlists) ? playlists : []).find(p => p.id === activePlaylistId)?.name || 'Main Library'
        : 'Main Library';
      await api.playTrack(track, activePlaylistId, currentPlaylistName);
    } catch (e) {
      console.error('Failed to play track', e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    try {
      await api.uploadFile(file);
      fetchTracks();
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    try {
      await api.createPlaylist(newPlaylistName);
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
      await api.addTrackToPlaylist(playlistId, trackId);
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

  const filteredTracks = (Array.isArray(tracks) ? tracks : []).filter(track => {
    const titleMatch = (track.title || track.name || track.query || '').toLowerCase().includes(searchQuery.toLowerCase());
    const artistMatch = (track.artist || '').toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || artistMatch;
  }).sort((a, b) => {
    if (sortMethod === 'name') {
      const aName = (a.title || a.name || a.query || '').toLowerCase();
      const bName = (b.title || b.name || b.query || '').toLowerCase();
      return aName.localeCompare(bName);
    }
    if (sortMethod === 'duration') {
      const aDur = parseInt(a.duration || '0');
      const bDur = parseInt(b.duration || '0');
      return bDur - aDur;
    }
    if (sortMethod === 'author') {
      const aArtist = (a.artist || '').toLowerCase();
      const bArtist = (b.artist || '').toLowerCase();
      return aArtist.localeCompare(bArtist);
    }
    return 0;
  });

  const activePlaylist = (Array.isArray(playlists) ? playlists : []).find(p => p.id === activePlaylistId);
  const playlistName = activePlaylist ? activePlaylist.name : 'All Tracks';


  return (
    <PlayerContext.Provider value={{
      user, loadingUser,
      status, setStatus,
      tracks, setTracks,
      newTrackInput, setNewTrackInput,
      seekValue, setSeekValue,
      playlists, setPlaylists,
      isModalOpen, setIsModalOpen,
      newPlaylistName, setNewPlaylistName,
      activeMenuId, setActiveMenuId,
      menuView, setMenuView,
      activePlaylistId, setActivePlaylistId,
      selectedTrack, setSelectedTrack,
      trackPlaylists, setTrackPlaylists,
      searchQuery, setSearchQuery,
      showSearch, setShowSearch,
      rightPanelMode, setRightPanelMode,
      importPlaylistModal, setImportPlaylistModal,
      importing, setImporting,
      deleteTrackModal, setDeleteTrackModal,
      deletePlaylistModal, setDeletePlaylistModal,
      editPlaylistModal, setEditPlaylistModal,
      rightCollapsed, setRightCollapsed,
      theme, setTheme, sortMethod, setSortMethod,
      leftCollapsed, setLeftCollapsed,
      fetchTracks, fetchPlaylists,
      handleAction, handleAddTrack, handleImportPlaylist,
      deleteTrackCompletely, deleteTrackFromPlaylist,
      deletePlaylist, editPlaylist,
      handleDeleteTrack, handlePlayTrack, handleFileUpload,
      handleCreatePlaylist, handleAddToPlaylist, formatTime,
      toggleTheme, handleRightToggle,
      duration, elapsed, filteredTracks, playlistName,
      sfxVolume, setSfxVolume
    }}>
      {children}
    </PlayerContext.Provider>
  );
};

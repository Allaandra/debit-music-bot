import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, USER_ID } from '../services/api';

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
    <PlayerContext.Provider value={{
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
      rightCollapsed, setRightCollapsed,
      theme, setTheme,
      leftCollapsed, setLeftCollapsed,
      fetchTracks, fetchPlaylists,
      handleAction, handleAddTrack, handleImportPlaylist,
      deleteTrackCompletely, deleteTrackFromPlaylist,
      handleDeleteTrack, handlePlayTrack, handleFileUpload,
      handleCreatePlaylist, handleAddToPlaylist, formatTime,
      toggleTheme, handleRightToggle
    }}>
      {children}
    </PlayerContext.Provider>
  );
};

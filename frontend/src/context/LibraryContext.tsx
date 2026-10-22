/* oxlint-disable react/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Track, Playlist, SortMethod } from '../types';
import { api } from '../services/api';
import { useUI } from './UIContext';
import { usePlayback } from './PlaybackContext';
import { useAuth } from './AuthContext';

export interface LibraryContextValue {
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  playlists: Playlist[];
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>;
  activePlaylistId: number | null;
  setActivePlaylistId: (id: number | null) => void;
  selectedTrack: Track | null;
  setSelectedTrack: (track: Track | null) => void;
  trackPlaylists: string[];
  setTrackPlaylists: React.Dispatch<React.SetStateAction<string[]>>;
  newTrackInput: string;
  setNewTrackInput: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortMethod: SortMethod;
  setSortMethod: React.Dispatch<React.SetStateAction<SortMethod>>;
  filteredTracks: Track[];
  activePlaylist: Playlist | undefined;
  playlistName: string;
  fetchTracks: (playlistId?: number | null) => Promise<void>;
  fetchPlaylists: () => Promise<void>;
  handleAddTrack: (e: React.FormEvent) => Promise<void>;
  handleImportPlaylist: (createPlaylist: boolean) => Promise<void>;
  deleteTrackCompletely: (track: Track) => Promise<void>;
  deleteTrackFromPlaylist: (track: Track) => Promise<void>;
  deletePlaylist: (playlistId: number, deleteTracks: boolean) => Promise<void>;
  editPlaylist: (playlistId: number, name?: string, icon?: string) => Promise<void>;
  handleDeleteTrack: (e: React.MouseEvent, track: Track) => Promise<void>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleCreatePlaylist: (e: React.FormEvent) => Promise<void>;
  handleAddToPlaylist: (e: React.MouseEvent, trackId: number, playlistId: number) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export const useLibrary = (): LibraryContextValue => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
};

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ui = useUI();
  const playback = usePlayback();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [newTrackInput, setNewTrackInput] = useState('');
  const [activePlaylistId, setActivePlaylistId] = useState<number | null>(() => {
    const saved = localStorage.getItem('activePlaylistId');
    return saved && saved !== 'undefined' ? JSON.parse(saved) : null;
  });

  const [userSelectedTrack, setUserSelectedTrack] = useState<{
    track: Track | null;
    forCurrentQuery: string | undefined;
  }>({ track: null, forCurrentQuery: undefined });
  const [, setTrackPlaylists] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [sortMethod, setSortMethod] = useState<SortMethod>(() => {
    return (localStorage.getItem('sortMethod') as SortMethod) || 'default';
  });

  useEffect(() => {
    localStorage.setItem('activePlaylistId', JSON.stringify(activePlaylistId));
  }, [activePlaylistId]);

  useEffect(() => {
    localStorage.setItem('sortMethod', sortMethod);
  }, [sortMethod]);

  const { data: tracks = [] } = useQuery<Track[]>({
    queryKey: ['tracks', activePlaylistId],
    queryFn: async () => {
      const data = await api.fetchTracks(activePlaylistId);
      return Array.isArray(data) ? data : ((data as any)?.tracks || []);
    },
    enabled: !!user
  });

  const { data: playlists = [] } = useQuery<Playlist[]>({
    queryKey: ['playlists'],
    queryFn: async () => {
      const data = await api.fetchPlaylists();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user
  });

  const setTracks: React.Dispatch<React.SetStateAction<Track[]>> = useCallback((updater) => {
    queryClient.setQueryData<Track[]>(['tracks', activePlaylistId], (old = []) =>
      typeof updater === 'function' ? updater(old) : updater
    );
  }, [queryClient, activePlaylistId]);

  const setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>> = useCallback((updater) => {
    queryClient.setQueryData<Playlist[]>(['playlists'], (old = []) =>
      typeof updater === 'function' ? updater(old) : updater
    );
  }, [queryClient]);

  const fetchTracks = useCallback(async (playlistId: number | null = activePlaylistId) => {
    await queryClient.invalidateQueries({ queryKey: ['tracks', playlistId] });
  }, [queryClient, activePlaylistId]);

  const fetchPlaylists = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['playlists'] });
  }, [queryClient]);

  const currentTrack = playback.status.currentTrack;
  const currentTrackQuery = currentTrack?.query;

  const setSelectedTrack = useCallback((track: Track | null) => {
    setUserSelectedTrack({
      track,
      forCurrentQuery: track ? currentTrackQuery : undefined
    });
  }, [currentTrackQuery]);

  // Derive selectedTrack synchronously during render (no cascading useEffect renders)
  const selectedTrack = useMemo<Track | null>(() => {
    const hasManualSelection =
      userSelectedTrack.track !== null &&
      userSelectedTrack.forCurrentQuery === currentTrackQuery;

    const baseTrack = hasManualSelection ? userSelectedTrack.track : (currentTrack || null);
    if (!baseTrack) return null;

    const matchingTrack = (Array.isArray(tracks) ? tracks : []).find(
      t => (baseTrack.id && t.id === baseTrack.id) || t.query === baseTrack.query
    );
    if (matchingTrack) {
      return { ...matchingTrack, ...baseTrack };
    }
    return baseTrack;
  }, [userSelectedTrack, currentTrack, currentTrackQuery, tracks]);

  // Instant zero-network lookup of playlists containing selectedTrack
  const trackPlaylists = useMemo<string[]>(() => {
    if (!selectedTrack) return [];
    if (Array.isArray(selectedTrack.playlistNames)) {
      return selectedTrack.playlistNames;
    }
    const matching = (Array.isArray(tracks) ? tracks : []).find(
      t => (selectedTrack.id && t.id === selectedTrack.id) || t.query === selectedTrack.query
    );
    return matching && Array.isArray(matching.playlistNames) ? matching.playlistNames : [];
  }, [selectedTrack, tracks]);

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrackInput) return;
    try {
      const data = await api.addTrack(newTrackInput);

      if (data?.status === 'playlist_detected') {
        ui.setImportPlaylistModal({ query: newTrackInput, title: data.title, count: data.total_tracks });
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
    if (!ui.importPlaylistModal) return;
    ui.setImporting(true);
    try {
      await api.importPlaylist(ui.importPlaylistModal.query, createPlaylist, ui.importPlaylistModal.title);
      ui.setImportPlaylistModal(null);
      fetchPlaylists();
      fetchTracks();
    } catch (e) {
      console.error('Failed to import playlist', e);
    } finally {
      ui.setImporting(false);
    }
  };

  const deleteTrackCompletely = async (track: Track) => {
    if (!track.id) return;
    try {
      await api.deleteTrackCompletely(track.id);
      fetchTracks();
      if (selectedTrack && selectedTrack.id === track.id) {
        setSelectedTrack(null);
      }
      ui.setDeleteTrackModal(null);
    } catch (e) {
      console.error('Failed to delete track', e);
    }
  };

  const deleteTrackFromPlaylist = async (track: Track) => {
    if (activePlaylistId === null || !track.id) return;
    try {
      await api.deleteTrackFromPlaylist(activePlaylistId, track.id);
      fetchTracks();
      ui.setDeleteTrackModal(null);
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
      ui.setDeletePlaylistModal(null);
    } catch (e) {
      console.error('Failed to delete playlist', e);
    }
  };

  const editPlaylist = async (playlistId: number, name?: string, icon?: string) => {
    try {
      await api.editPlaylist(playlistId, { name, icon });
      fetchPlaylists();
      if (activePlaylistId === playlistId) fetchTracks(playlistId);
      ui.setEditPlaylistModal(null);
    } catch (e) {
      console.error('Failed to edit playlist', e);
    }
  };

  const handleDeleteTrack = async (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    ui.setActiveMenuId(null);
    if (activePlaylistId !== null) {
      ui.setDeleteTrackModal(track);
    } else {
      const isLocal = track.type === 'local';
      const msg = isLocal
        ? 'Вы уверены, что хотите удалить этот локальный файл? (Он будет навсегда удалён с жёсткого диска!)'
        : 'Вы уверены, что хотите удалить этот трек из библиотеки?';

      if (!window.confirm(msg)) return;
      deleteTrackCompletely(track);
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
    if (!ui.newPlaylistName.trim()) return;
    try {
      await api.createPlaylist(ui.newPlaylistName);
      ui.setNewPlaylistName('');
      ui.setIsModalOpen(false);
      fetchPlaylists();
    } catch (err) {
      console.error('Failed to create playlist', err);
    }
  };

  const handleAddToPlaylist = async (e: React.MouseEvent, trackId: number, playlistId: number) => {
    e.stopPropagation();
    try {
      await api.addTrackToPlaylist(playlistId, trackId);
      ui.setActiveMenuId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tracks'] }),
        queryClient.invalidateQueries({ queryKey: ['playlists'] })
      ]);
    } catch (err) {
      console.error('Failed to add track to playlist', err);
    }
  };

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
      const aDur = a.duration || 0;
      const bDur = b.duration || 0;
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
    <LibraryContext.Provider
      value={{
        tracks,
        setTracks,
        playlists,
        setPlaylists,
        activePlaylistId,
        setActivePlaylistId,
        selectedTrack,
        setSelectedTrack,
        trackPlaylists,
        setTrackPlaylists,
        newTrackInput,
        setNewTrackInput,
        searchQuery,
        setSearchQuery,
        sortMethod,
        setSortMethod,
        filteredTracks,
        activePlaylist,
        playlistName,
        fetchTracks,
        fetchPlaylists,
        handleAddTrack,
        handleImportPlaylist,
        deleteTrackCompletely,
        deleteTrackFromPlaylist,
        deletePlaylist,
        editPlaylist,
        handleDeleteTrack,
        handleFileUpload,
        handleCreatePlaylist,
        handleAddToPlaylist
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

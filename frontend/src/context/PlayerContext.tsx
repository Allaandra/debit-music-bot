/* oxlint-disable react/only-export-components */
import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import type { AuthContextValue } from './AuthContext';
import { UIProvider, useUI } from './UIContext';
import type { UIContextValue } from './UIContext';
import { PlaybackProvider, usePlayback } from './PlaybackContext';
import type { PlaybackContextValue } from './PlaybackContext';
import { LibraryProvider, useLibrary } from './LibraryContext';
import type { LibraryContextValue } from './LibraryContext';
import type { Track } from '../types';

export * from './AuthContext';
export * from './UIContext';
export * from './PlaybackContext';
export * from './LibraryContext';
export * from '../types';

export type PlayerContextValue = AuthContextValue &
  UIContextValue &
  PlaybackContextValue &
  LibraryContextValue & {
    USER_ID?: string;
  };

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <UIProvider>
        <PlaybackProvider>
          <LibraryProvider>
            {children}
          </LibraryProvider>
        </PlaybackProvider>
      </UIProvider>
    </AuthProvider>
  );
};

export const usePlayer = (): PlayerContextValue => {
  const auth = useAuth();
  const ui = useUI();
  const playback = usePlayback();
  const library = useLibrary();

  const handlePlayTrack = async (track: Track) => {
    library.setSelectedTrack(null);
    const currentPlaylistName = library.activePlaylistId
      ? library.playlists.find(p => p.id === library.activePlaylistId)?.name || 'Main Library'
      : 'Main Library';
    await playback.handlePlayTrack(track, library.activePlaylistId, currentPlaylistName);
  };

  return {
    ...auth,
    ...ui,
    ...playback,
    ...library,
    handlePlayTrack,
    USER_ID: auth.user?.id
  };
};

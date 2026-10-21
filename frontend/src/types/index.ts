export type Theme = 'forest' | 'dark' | 'light';
export type RightPanelMode = 'queue' | 'info' | 'sfx';
export type SortMethod = 'default' | 'name' | 'duration' | 'author';
export type MenuView = 'main' | 'playlists';
export type RepeatMode = 'off' | 'track' | 'all';

export interface User {
  id: string;
  username: string;
  avatar: string | null;
}

export interface Track {
  id?: number;
  ownerId?: string;
  title: string;
  artist?: string;
  type: 'local' | 'url';
  query: string;
  duration?: number;
  thumbnail?: string;
  url?: string;
  platform?: string;
  addedAt?: string;
  name?: string; // fallback in legacy objects
}

export interface Playlist {
  id: number;
  ownerId?: string;
  name: string;
  icon?: string | null;
  createdAt?: string;
  tracks?: { track: Track; position?: number }[];
  editMode?: 'cover' | 'rename' | string;
  trackCount?: number;
}

export interface PlayerStatus {
  isPlaying: boolean;
  isPaused: boolean;
  currentTrack: Track | null;
  elapsed: number;
  duration?: number;
  queue: Track[];
  activePlaylistName?: string;
  queueLength?: number;
  shuffle?: boolean;
  repeatMode?: RepeatMode;
  volume?: number;
  loopingSfx?: number[];
  guildId?: string;
}

export interface SfxSound {
  id: number;
  ownerId: string;
  playlistId: number;
  title: string;
  filename: string;
  duration?: number | null;
  isGlobal: boolean;
  createdAt?: string;
  canEdit?: boolean;
}

export interface SfxPlaylist {
  id: number;
  ownerId: string;
  name: string;
  icon?: string | null;
  order: number;
  createdAt?: string;
  sounds: SfxSound[];
}

export interface ImportPlaylistModalData {
  query: string;
  title: string;
  count: number;
}

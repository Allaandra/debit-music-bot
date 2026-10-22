/* oxlint-disable react/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Theme, RightPanelMode, MenuView, Track, Playlist, ImportPlaylistModalData } from '../types';

export interface UIContextValue {
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  toggleTheme: () => void;
  leftCollapsed: boolean;
  setLeftCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  rightCollapsed: boolean;
  setRightCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  rightPanelMode: RightPanelMode;
  setRightPanelMode: React.Dispatch<React.SetStateAction<RightPanelMode>>;
  handleRightToggle: (view: RightPanelMode) => void;
  showSearch: boolean;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  activeMenuId: number | null;
  setActiveMenuId: React.Dispatch<React.SetStateAction<number | null>>;
  menuView: MenuView;
  setMenuView: React.Dispatch<React.SetStateAction<MenuView>>;
  isModalOpen: boolean;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newPlaylistName: string;
  setNewPlaylistName: React.Dispatch<React.SetStateAction<string>>;
  importPlaylistModal: ImportPlaylistModalData | null;
  setImportPlaylistModal: React.Dispatch<React.SetStateAction<ImportPlaylistModalData | null>>;
  importing: boolean;
  setImporting: React.Dispatch<React.SetStateAction<boolean>>;
  deleteTrackModal: Track | null;
  setDeleteTrackModal: React.Dispatch<React.SetStateAction<Track | null>>;
  deletePlaylistModal: Playlist | null;
  setDeletePlaylistModal: React.Dispatch<React.SetStateAction<Playlist | null>>;
  editPlaylistModal: Playlist | null;
  setEditPlaylistModal: React.Dispatch<React.SetStateAction<Playlist | null>>;
}

const UIContext = createContext<UIContextValue | null>(null);

export const useUI = (): UIContextValue => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'forest';
  });
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('leftCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [rightCollapsed, setRightCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('rightCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>(() => {
    return (localStorage.getItem('rightPanelMode') as RightPanelMode) || 'queue';
  });

  const [showSearch, setShowSearch] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuView, setMenuView] = useState<MenuView>('main');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [importPlaylistModal, setImportPlaylistModal] = useState<ImportPlaylistModalData | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleteTrackModal, setDeleteTrackModal] = useState<Track | null>(null);
  const [deletePlaylistModal, setDeletePlaylistModal] = useState<Playlist | null>(null);
  const [editPlaylistModal, setEditPlaylistModal] = useState<Playlist | null>(null);

  useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('leftCollapsed', JSON.stringify(leftCollapsed)); }, [leftCollapsed]);
  useEffect(() => { localStorage.setItem('rightCollapsed', JSON.stringify(rightCollapsed)); }, [rightCollapsed]);
  useEffect(() => { localStorage.setItem('rightPanelMode', rightPanelMode); }, [rightPanelMode]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'forest' ? 'dark' : prev === 'dark' ? 'light' : 'forest'));
  };

  const handleRightToggle = (view: RightPanelMode) => {
    if (rightPanelMode === view && !rightCollapsed) {
      setRightCollapsed(true);
    } else {
      setRightPanelMode(view);
      setRightCollapsed(false);
    }
  };

  return (
    <UIContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        leftCollapsed,
        setLeftCollapsed,
        rightCollapsed,
        setRightCollapsed,
        rightPanelMode,
        setRightPanelMode,
        handleRightToggle,
        showSearch,
        setShowSearch,
        activeMenuId,
        setActiveMenuId,
        menuView,
        setMenuView,
        isModalOpen,
        setIsModalOpen,
        newPlaylistName,
        setNewPlaylistName,
        importPlaylistModal,
        setImportPlaylistModal,
        importing,
        setImporting,
        deleteTrackModal,
        setDeleteTrackModal,
        deletePlaylistModal,
        setDeletePlaylistModal,
        editPlaylistModal,
        setEditPlaylistModal
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

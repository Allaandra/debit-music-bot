import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Music, Swords, CheckCircle2, AlertCircle, ListMusic, FolderPlus } from 'lucide-react';
import { api } from '../services/api';
import { useLibrary, useUI } from '../context/PlayerContext';
import '../assets/css/DragDropOverlay.css';

const VALID_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.opus']);

function getRussianPlural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

interface ToastState {
  type: 'loading' | 'success' | 'error';
  message: string;
  submessage?: string;
}

export const DragDropOverlay: React.FC = () => {
  const queryClient = useQueryClient();
  const { activePlaylistId, activePlaylist } = useLibrary();
  const { leftCollapsed, rightCollapsed, setRightPanelMode, setRightCollapsed } = useUI();

  const [isDragging, setIsDragging] = useState(false);
  const [activeZone, setActiveZone] = useState<'left' | 'center' | 'right'>('center');
  const [fileCount, setFileCount] = useState<number>(1);
  const [hoveredPlaylist, setHoveredPlaylist] = useState<{ id: number; name: string } | null>(null);
  const [hoveredPlaylistRect, setHoveredPlaylistRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dragCounterRef = useRef(0);

  const showToast = useCallback((t: ToastState, autoDismissMs = 4000) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast(t);
    if (autoDismissMs > 0) {
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
      }, autoDismissMs);
    }
  }, []);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer?.types?.includes('Files')) return;

    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragging(true);
      const count = e.dataTransfer.items ? e.dataTransfer.items.length : 1;
      setFileCount(count > 0 ? count : 1);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer?.types?.includes('Files')) return;

    e.dataTransfer.dropEffect = 'copy';

    if (!isDragging) {
      setIsDragging(true);
    }

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setFileCount(e.dataTransfer.items.length);
    }

    // Precise zone collision based on the middle .center-panel DOM element
    const centerPanel = document.querySelector('.center-panel');
    if (centerPanel) {
      const cRect = centerPanel.getBoundingClientRect();
      if (e.clientX < cRect.left) {
        setActiveZone('left');
        const targetElement = document.elementFromPoint(e.clientX, e.clientY);
        const playlistElement = targetElement?.closest('[data-playlist-id]');
        if (playlistElement) {
          const pId = Number(playlistElement.getAttribute('data-playlist-id'));
          const pName = playlistElement.getAttribute('data-playlist-name') || 'Плейлист';
          if (!isNaN(pId)) {
            setHoveredPlaylist({ id: pId, name: pName });
            const pRect = playlistElement.getBoundingClientRect();
            const containerElem = document.querySelector('.main-container');
            if (containerElem) {
              const contRect = containerElem.getBoundingClientRect();
              setHoveredPlaylistRect({
                top: pRect.top - contRect.top,
                left: pRect.left - contRect.left,
                width: pRect.width,
                height: pRect.height
              });
            }
            return;
          }
        }
        setHoveredPlaylist(null);
        setHoveredPlaylistRect(null);
        return;
      } else if (e.clientX > cRect.right) {
        setActiveZone('right');
        setHoveredPlaylist(null);
        setHoveredPlaylistRect(null);
        return;
      } else {
        setActiveZone('center');
        setHoveredPlaylist(null);
        setHoveredPlaylistRect(null);
        return;
      }
    }

    setActiveZone('center');
    setHoveredPlaylist(null);
    setHoveredPlaylistRect(null);
  }, [isDragging]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer?.types?.includes('Files')) return;

    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
      setHoveredPlaylist(null);
      setHoveredPlaylistRect(null);
    }
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    setHoveredPlaylistRect(null);

    if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) {
      setHoveredPlaylist(null);
      return;
    }

    const rawFiles = Array.from(e.dataTransfer.files);
    const audioFiles = rawFiles.filter(file => {
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      return VALID_AUDIO_EXTENSIONS.has(ext);
    });

    if (audioFiles.length === 0) {
      showToast({
        type: 'error',
        message: 'Неподдерживаемый формат',
        submessage: 'Перетащите аудиофайлы (.mp3, .wav, .ogg, .flac, .m4a)'
      }, 5000);
      setHoveredPlaylist(null);
      return;
    }

    const count = audioFiles.length;
    const pluralTracks = getRussianPlural(count, 'трек', 'трека', 'треков');
    const pluralSfx = getRussianPlural(count, 'эффект', 'эффекта', 'эффектов');

    // === ZONE 1: LEFT SIDEBAR (PLAYLISTS) ===
    if (activeZone === 'left') {
      const targetPlaylistId = hoveredPlaylist?.id || activePlaylistId || undefined;
      const targetName = hoveredPlaylist?.name || (activePlaylist ? activePlaylist.name : 'Фонотека');

      showToast({
        type: 'loading',
        message: `Загрузка ${count} ${pluralTracks}...`,
        submessage: targetPlaylistId ? `В плейлист «${targetName}»` : 'В фонотеку'
      }, 0);

      try {
        await api.uploadFiles(audioFiles, targetPlaylistId);

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['tracks'] }),
          queryClient.invalidateQueries({ queryKey: ['playlists'] })
        ]);

        showToast({
          type: 'success',
          message: `Успешно загружено ${count} ${pluralTracks}!`,
          submessage: targetPlaylistId ? `Добавлено в плейлист «${targetName}»` : 'Добавлено в библиотеку'
        }, 4000);
      } catch (err: any) {
        console.error('Failed to upload music batch:', err);
        showToast({
          type: 'error',
          message: 'Ошибка при загрузке треков',
          submessage: err.message || 'Проверьте соединение с сервером'
        }, 5000);
      }
    } 
    // === ZONE 2: MIDDLE PANEL (MUSIC / TRACKS TABLE) ===
    else if (activeZone === 'center') {
      const targetPlaylistId = activePlaylistId || undefined;
      const targetName = activePlaylist ? activePlaylist.name : 'Общая фонотека';

      showToast({
        type: 'loading',
        message: `Загрузка ${count} ${pluralTracks} в Музыку...`,
        submessage: activePlaylist ? `В плейлист «${targetName}»` : 'В общую библиотеку'
      }, 0);

      try {
        await api.uploadFiles(audioFiles, targetPlaylistId);

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['tracks'] }),
          queryClient.invalidateQueries({ queryKey: ['playlists'] })
        ]);

        showToast({
          type: 'success',
          message: `Успешно загружено ${count} ${pluralTracks}!`,
          submessage: activePlaylist ? `Добавлено в «${targetName}»` : 'Добавлено в библиотеку'
        }, 4000);
      } catch (err: any) {
        console.error('Failed to upload music batch:', err);
        showToast({
          type: 'error',
          message: 'Ошибка при загрузке треков',
          submessage: err.message || 'Проверьте соединение с сервером'
        }, 5000);
      }
    }
    // === ZONE 3: RIGHT SIDEBAR (SFX BOARD) ===
    else if (activeZone === 'right') {
      setRightCollapsed(false);
      setRightPanelMode('sfx');

      try {
        let sfxPlaylists: any[] = queryClient.getQueryData(['sfxPlaylists']) || [];
        if (!sfxPlaylists || sfxPlaylists.length === 0) {
          sfxPlaylists = await api.fetchSfxPlaylists();
        }

        const userPlaylists = sfxPlaylists.filter((p: any) => p.id > 0);
        const targetCategory = userPlaylists[0] || sfxPlaylists[0];

        if (!targetCategory) {
          throw new Error('Нет доступных категорий SFX');
        }

        showToast({
          type: 'loading',
          message: `Загрузка ${count} ${pluralSfx} в SFX...`,
          submessage: `Категория: «${targetCategory.name}»`
        }, 0);

        await api.uploadSfxBatch(audioFiles, targetCategory.id);

        await queryClient.invalidateQueries({ queryKey: ['sfxPlaylists'] });

        showToast({
          type: 'success',
          message: `Успешно загружено ${count} ${pluralSfx}!`,
          submessage: `Добавлено в категорию «${targetCategory.name}»`
        }, 4000);
      } catch (err: any) {
        console.error('Failed to upload SFX batch:', err);
        showToast({
          type: 'error',
          message: 'Ошибка при загрузке звуковых эффектов',
          submessage: err.message || 'Не удалось сохранить файлы'
        }, 5000);
      }
    }

    setHoveredPlaylist(null);
  }, [activeZone, hoveredPlaylist, activePlaylistId, activePlaylist, queryClient, setRightCollapsed, setRightPanelMode, showToast]);

  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragOver, handleDragLeave, handleDrop]);

  const tracksPlural = getRussianPlural(fileCount, 'трек', 'трека', 'треков');
  const sfxPlural = getRussianPlural(fileCount, 'эффект', 'эффекта', 'эффектов');

  return (
    <>
      {/* 3-PANEL DROP OVERLAY INSIDE .main-container */}
      {isDragging && (
        <div className="drag-drop-overlay-root">
          {/* PANEL 1: LEFT SIDEBAR (PLAYLISTS) — Fully visible underneath */}
          <div className={`drag-zone drag-zone-left ${leftCollapsed ? 'collapsed' : ''} ${activeZone === 'left' ? 'active' : 'dimmed'}`}>
            <div className="drag-zone-left-header">
              <div className={`drag-zone-left-pill ${hoveredPlaylist ? 'highlight' : ''}`}>
                <ListMusic size={15} />
                <span>
                  {hoveredPlaylist
                    ? `В плейлист «${hoveredPlaylist.name}»`
                    : (fileCount > 1 ? `Бросьте ${fileCount} ${tracksPlural} на плейлист` : 'Бросьте на строку плейлиста')}
                </span>
              </div>
            </div>

            {/* Glowing target rectangle over the exact hovered playlist row */}
            {hoveredPlaylistRect && (
              <div
                className="drag-playlist-target-glow"
                style={{
                  top: hoveredPlaylistRect.top,
                  left: hoveredPlaylistRect.left,
                  width: hoveredPlaylistRect.width,
                  height: hoveredPlaylistRect.height,
                }}
              >
                <span className="drag-playlist-target-badge">
                  <FolderPlus size={11} /> {hoveredPlaylist?.name}
                </span>
              </div>
            )}
          </div>

          {/* PANEL 2: MIDDLE PANEL (MUSIC / TRACKS TABLE) */}
          <div className={`drag-zone drag-zone-center ${activeZone === 'center' ? 'active' : 'dimmed'}`}>
            <div className="drag-zone-card">
              <div className="drag-zone-icon-wrap">
                <Music size={42} strokeWidth={2.2} />
              </div>
              <h2 className="drag-zone-title">
                {fileCount > 1 ? `Загрузить ${fileCount} ${tracksPlural} в Музыку` : 'Загрузить в Музыку'}
              </h2>
              <div className="drag-zone-badge">
                <Music size={13} />
                <span>{activePlaylist ? `В плейлист «${activePlaylist.name}»` : 'В общую фонотеку'}</span>
              </div>
              <p className="drag-zone-hint">
                Файлы станут доступны для воспроизведения в очереди
              </p>
            </div>
          </div>

          {/* PANEL 3: RIGHT SIDEBAR (SFX BOARD) */}
          <div className={`drag-zone drag-zone-right ${rightCollapsed ? 'collapsed' : ''} ${activeZone === 'right' ? 'active' : 'dimmed'}`}>
            <div className={`drag-zone-card ${rightCollapsed ? 'compact' : ''}`}>
              <div className={`drag-zone-icon-wrap ${rightCollapsed ? 'compact' : ''}`}>
                <Swords size={rightCollapsed ? 24 : 36} strokeWidth={2.2} />
              </div>
              {!rightCollapsed ? (
                <>
                  <h3 className="drag-zone-title">
                    {fileCount > 1 ? `Загрузить ${fileCount} ${sfxPlural}` : 'Загрузить в SFX'}
                  </h3>
                  <div className="drag-zone-badge">
                    <Swords size={12} />
                    <span>Звуки боя и магии</span>
                  </div>
                  <p className="drag-zone-hint">
                    Быстрые кнопки звуковых эффектов для ДМа
                  </p>
                </>
              ) : (
                <span className="drag-zone-title compact">SFX</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FLOATING STATUS TOAST VIA PORTAL */}
      {toast && createPortal(
        <div className="drag-toast-container">
          <div className={`drag-toast toast-${toast.type}`}>
            <div className="drag-toast-icon">
              {toast.type === 'loading' && <div className="drag-toast-spinner" />}
              {toast.type === 'success' && <CheckCircle2 size={22} color="#86e59c" />}
              {toast.type === 'error' && <AlertCircle size={22} color="#ff7070" />}
            </div>
            <div className="drag-toast-body">
              <div className="drag-toast-message">{toast.message}</div>
              {toast.submessage && (
                <div className="drag-toast-submessage">{toast.submessage}</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

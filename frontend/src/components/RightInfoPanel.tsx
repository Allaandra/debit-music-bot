import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Music } from 'lucide-react';

export const RightInfoPanel = () => {
  const { status, selectedTrack, trackPlaylists } = usePlayer();

  return (
    <>
      <div className="track-info-view">
        <div className="ti-stair-1">
          <div className="large-art" style={{ position: 'relative' }}>
            {selectedTrack && selectedTrack.thumbnail ? (
              <img src={selectedTrack.thumbnail.startsWith('/') ? `http://localhost:3001${selectedTrack.thumbnail}` : selectedTrack.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }} alt="art" />
            ) : (
              <div className="art-placeholder" style={{ borderRadius: '16px' }}></div>
            )}
            <div className="cd-hole-overlay"></div>
          </div>
          <h2 className="ti-title">{selectedTrack ? (selectedTrack.title || selectedTrack.query || selectedTrack.name || 'Unknown') : 'Not Playing'}</h2>
          <span className="ti-author">{selectedTrack ? (selectedTrack.artist || 'Unknown') : '-'}</span>
        </div>
        
        {selectedTrack ? (
          <div className="ti-stair-2">
            <div className="ti-details">
              <div className="ti-detail-item">Platform: {(() => {
                if (selectedTrack.type === 'local') return 'Local File';
                const q = selectedTrack.query || '';
                if (q.includes('spotify.com') || q.startsWith('spotify:')) return 'Spotify';
                if (q.includes('youtube.com') || q.includes('youtu.be')) return 'YouTube';
                if (q.includes('soundcloud.com')) return 'SoundCloud';
                if (q.startsWith('http')) return 'Web';
                return 'Search Query';
              })()}</div>
              {selectedTrack.type === 'url' && (
                <div className="ti-detail-item">Streaming: {(() => {
                  const u = selectedTrack.url || '';
                  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'YouTube';
                  if (u.includes('soundcloud.com')) return 'SoundCloud';
                  return 'YouTube';
                })()}</div>
              )}
              {selectedTrack.type === 'url' && selectedTrack.query && (
                <div className="ti-detail-item">Source: {(selectedTrack.query.startsWith('http') || selectedTrack.query.startsWith('spotify:')) ? (
                  <a href={selectedTrack.query} target="_blank" rel="noreferrer" style={{color: 'var(--accent)'}}>URL</a>
                ) : (
                  <span>{selectedTrack.query}</span>
                )}</div>
              )}
              <div className="ti-detail-item">Is in: {trackPlaylists.length > 0 ? trackPlaylists.join(', ') : '-'}</div>
            </div>
          </div>
        ) : (
          <div className="ti-stair-2">
            <div className="ti-details" style={{ opacity: 0.5, textAlign: 'center', marginTop: '20px' }}>
              <div className="ti-detail-item">Select a track to view info</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

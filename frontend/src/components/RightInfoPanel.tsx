import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Music } from 'lucide-react';

export const RightInfoPanel = () => {
  const { status, selectedTrack, trackPlaylists } = usePlayer();

  return (
    <>

                <div className="track-info-view">
                  {selectedTrack ? (
                    <>
                      <div className="ti-stair-1">
                        <div className="large-art">
                          {selectedTrack.thumbnail ? (
                            <img src={selectedTrack.thumbnail.startsWith('/') ? `http://localhost:3001${selectedTrack.thumbnail}` : selectedTrack.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }} alt="art" />
                          ) : (
                            <div className="cd-circle">
                              <div className="cd-hole"></div>
                            </div>
                          )}
                        </div>
                        <h2 className="ti-title">{selectedTrack.title || selectedTrack.query || selectedTrack.name || 'Unknown'}</h2>
                        <span className="ti-author">{selectedTrack.artist || 'Unknown'}</span>
                      </div>
                      
                      <div className="ti-stair-2">
                        <div className="ti-details">
                          <div className="ti-detail-item">Platform: {selectedTrack.type === 'local' ? 'Local File' : 'YouTube'}</div>
                          {selectedTrack.url && (
                            <div className="ti-detail-item">URL: <a href={selectedTrack.url} target="_blank" rel="noreferrer" style={{color: 'var(--accent)'}}>Link</a></div>
                          )}
                          <div className="ti-detail-item">Is in: {trackPlaylists.length > 0 ? trackPlaylists.join(', ') : 'Нет'}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>Select a track to view info</div>
                  )}
                </div>

    </>
  );
};

import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Music } from 'lucide-react';

export const RightQueuePanel = () => {
  const { status, selectedTrack, trackPlaylists } = usePlayer();

  return (
    <>

                <div className="queue-view">
                  <div className="queue-stair-1">
                    <h2 className="queue-title">Queue: {status.activePlaylistName || 'Main Library'}</h2>
                  </div>
                  
                  <div className="queue-stair-2">
                    <h3 className="section-title">Now playing</h3>
                    {status.currentTrack ? (
                      <div className="queue-track">
                        <div className="track-icon-lg">
                          {status.currentTrack.thumbnail ? (
                            <img src={status.currentTrack.thumbnail.startsWith('/') ? `http://localhost:3001${status.currentTrack.thumbnail}` : status.currentTrack.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} alt="thumb" />
                          ) : (
                            <Music size={20} />
                          )}
                        </div>
                        <div className="queue-track-info">
                          <span className="queue-track-name">{status.currentTrack.title || status.currentTrack.query}</span>
                          <span className="queue-track-author">{status.currentTrack.artist || 'Unknown'}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Empty</div>
                    )}
                  </div>
                  
                  <div className="queue-stair-3">
                    <h3 className="section-title">Next</h3>
                    {status.queue && status.queue.length > 0 ? (
                      status.queue.map((qTrack: any, i: number) => (
                        <div className="queue-track" key={i}>
                          <div className="track-icon-lg">
                            {qTrack.thumbnail ? (
                              <img src={qTrack.thumbnail.startsWith('/') ? `http://localhost:3001${qTrack.thumbnail}` : qTrack.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} alt="thumb" />
                            ) : (
                              <Music size={20} />
                            )}
                          </div>
                          <div className="queue-track-info">
                            <span className="queue-track-name">{qTrack.title || qTrack.query}</span>
                            <span className="queue-track-author">{qTrack.artist || 'Unknown'}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Queue is empty</div>
                    )}
                  </div>
                </div>

    </>
  );
};

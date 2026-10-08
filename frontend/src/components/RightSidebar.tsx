import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { RightQueuePanel } from './RightQueuePanel';
import { RightInfoPanel } from './RightInfoPanel';

export const RightSidebar = () => {
  const { rightCollapsed, rightPanelMode } = usePlayer();

  return (
    <>
      <aside className={`right-sidebar ${rightCollapsed ? 'collapsed' : ''}`}>
        <div className="right-sidebar-inner">
          <div className="right-sidebar-content">
            {rightPanelMode === 'queue' ? (
              <RightQueuePanel />
            ) : (
              <RightInfoPanel />
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

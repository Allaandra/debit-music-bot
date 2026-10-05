import React from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { LeftSidebar } from './components/LeftSidebar';
import { MainPanel } from './components/MainPanel';
import { RightSidebar } from './components/RightSidebar';
import { PlayerBar } from './components/PlayerBar';
import { Modals } from './components/Modals';

import './assets/css/index.css';
import './assets/css/App.css';
import './assets/css/Player.css';

function AppLayout() {
  const { theme, setActiveMenuId, setMenuView } = usePlayer();
  return (
    <div className={`player-app theme-${theme}`} onClick={() => { setActiveMenuId(null); setMenuView('main'); }}>
      <div className="main-container">
        <LeftSidebar />
        <MainPanel />
        <RightSidebar />
      </div>
      <PlayerBar />
      <Modals />
    </div>
  );
}

export default function App() {
  return (
    <PlayerProvider>
      <AppLayout />
    </PlayerProvider>
  );
}

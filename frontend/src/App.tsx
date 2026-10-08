import React from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { LeftSidebar } from './components/LeftSidebar';
import { MainPanel } from './components/MainPanel';
import { RightSidebar } from './components/RightSidebar';
import { PlayerBar } from './components/PlayerBar';
import { Modals } from './components/Modals';

import './assets/css/Themes.css';
import './assets/css/Globals.css';
import './assets/css/LeftSidebar.css';
import './assets/css/MainPanel.css';
import './assets/css/RightSidebar.css';
import './assets/css/PlayerBar.css';
import './assets/css/Modals.css';

import { api, BASE_URL } from './services/api';

function AppLayout() {
  const { theme, setActiveMenuId, setMenuView } = usePlayer();
  const { user, loadingUser } = usePlayer();

  if (loadingUser) return <div style={{ color: 'white', padding: 50 }}>Loading...</div>;

  if (!user) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121212', color: 'white', flexDirection: 'column', gap: 20 }}>
        <h2>D&D Music Bot</h2>
        <p>Для управления музыкой необходимо авторизоваться</p>
        <button 
          onClick={() => window.location.href = `${BASE_URL}/auth/login`}
          style={{ padding: '12px 24px', fontSize: 16, backgroundColor: '#5865F2', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          Войти через Discord
        </button>
      </div>
    );
  }

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

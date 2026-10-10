import React from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { LeftSidebar } from './components/LeftSidebar';
import { MainPanel } from './components/MainPanel';
import { RightSidebar } from './components/RightSidebar';
import { PlayerBar } from './components/PlayerBar';
import { Modals } from './components/Modals';
import { LoginScreen } from './components/LoginScreen';

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
    return <LoginScreen />;
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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'white', backgroundColor: '#8b0000', padding: 50, height: '100vh' }}>
          <h2>Something went wrong in the UI.</h2>
          <pre>{this.state.error?.toString()}</pre>
          <button onClick={() => { localStorage.clear(); window.location.href = '/'; }}>Clear Data & Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PlayerProvider>
          <AppLayout />
        </PlayerProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}





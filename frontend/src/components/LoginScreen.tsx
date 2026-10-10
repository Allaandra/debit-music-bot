import React from 'react';
import { BASE_URL } from '../services/api';

export const LoginScreen = () => {
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121212', color: 'white', flexDirection: 'column', gap: 20 }}>
      <h2>D&D Music Bot</h2>
      <p>Please log in with Discord to access your audio files and settings.</p>
      <button 
        onClick={() => window.location.href = `${BASE_URL}/auth/login`}
        style={{ padding: '12px 24px', fontSize: 16, backgroundColor: '#5865F2', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
      >
        Login with Discord
      </button>
    </div>
  );
};

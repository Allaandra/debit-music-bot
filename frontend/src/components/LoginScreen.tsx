import React from 'react';
import { BASE_URL } from '../services/api';

export const LoginScreen = () => {
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121212', color: 'white', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 800, letterSpacing: '0.02em', margin: 0, color: 'var(--text-main, #f2f7f3)' }}>
        D&D Music Bot
      </h2>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', color: '#adc4b0', lineHeight: 1.5, margin: 0 }}>
        Please log in with Discord to access your audio files and settings.
      </p>
      <button 
        onClick={() => window.location.href = `${BASE_URL}/auth/login`}
        style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, padding: '12px 28px', fontSize: 15, letterSpacing: '0.02em', backgroundColor: '#5865F2', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' }}
      >
        Login with Discord
      </button>
      <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', marginTop: 8 }}>v2.6.0</span>
    </div>
  );
};

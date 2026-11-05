<div align="center">

# Debit Music Bot 🎧🐉

[![English](https://img.shields.io/badge/Language-English-blue?style=flat-square)](README.md)
[![Українська](https://img.shields.io/badge/Мова-Українська-yellow?style=flat-square)](README.uk.md)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=flat-square&logo=discord)](https://discord.js.org)

**A specialized Discord music companion with an interactive Spotify-inspired web dashboard for Dungeon Masters conducting D&D and tabletop role-playing games (TTRPGs).**

[Features](#-key-features) • [Discord Commands](#-discord-commands) • [Quick Start](#-quick-start) • [Tech Stack](#-tech-stack)

</div>

---

## 🌟 Key Features

- 🎛️ **Full-Featured DM Web Dashboard (React 19):**
  - **Playback Management:** Play, Pause, Fast Seek, Shuffle, and Repeat (track or queue).
  - **Dual Volume Control:** Independent real-time sliders for background music and sound effects (0–200%).
  - **Live Synchronization:** Real-time state synchronization across all connected browser tabs via **Socket.IO** (instant updates, no polling).
  - **Parallax Login Screen:** 3D multi-layer parallax authentication view featuring Canvas sparkles, responsive controls, and accessible typography.

- ⚔️ **SFX Soundboard & Ambience:**
  - **Real-Time PCM Audio Mixer:** 20ms frame mixer overlaying combat sounds, spell effects, and dice rolls directly over active music with zero clicks or stream interruptions.
  - **Seamless Ambience Loops:** Sample-accurate looping buffer (`createSeamlessLoopBuffer`) for continuous atmospheric audio (rain, campfires, taverns).
  - **Organized Categories:** Category tiles with Lucide vector icons, marquee labels for long titles, and silent preview in DM headphones.
  - **Campaign Sharing:** Global sound sharing toggle (`isGlobal` 🌐) to share assets across multiple campaigns.

- 🎵 **Multi-Source Audio Streaming:**
  - **Streaming Integration:** Native playback for YouTube links, Spotify tracks/playlists, and SoundCloud streams.
  - **Fault-Tolerant Pipeline:** Powered by `yt-dlp` and `ffmpeg` with auto-reconnection, 403 Forbidden CloudFront token upgrade, and automatic SoundCloud fallback.
  - **Local Media Support:** Direct playback of files from disk (`.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, `.aac`, `.opus`).
  - **3-Zone Drag & Drop:** Batch audio upload (up to 50 files) directly into playlists or specific SFX categories.

- 🔐 **Security & Multi-User Isolation:**
  - **OAuth2 Authentication:** Official Discord OAuth2 login with secure `httpOnly` JWT cookie sessions.
  - **Data Isolation:** Complete data privacy ensuring each Dungeon Master only accesses their own uploaded tracks, categories, and playlists.

- 🚀 **Zero-Config One-Click Launch:**
  - Automated `start_bot.bat` launcher checks Node.js, installs dependencies, initializes SQLite via Prisma, builds frontend assets, and launches the browser dashboard.

---

## 💬 Discord Commands

| Command | Description |
| :--- | :--- |
| `!join` | Connects the bot to your current voice channel and pairs your session with the web panel |
| `!leave` | Stops playback, clears the queue, and disconnects the bot from the voice channel |
| `!np` | Displays the currently playing track, artist, status, and visual text progress bar |
| `!panel` | Posts a direct clickable link to the web control dashboard in chat |
| `!ping` | Measures message latency and Discord WebSocket heartbeat ping |
| `!help` | Displays the list of all available bot commands |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [FFmpeg](https://ffmpeg.org/) (bundled automatically via `ffmpeg-static`)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Allaandra/debit-music-bot.git
   cd debit-music-bot
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. **Fill in the credentials in `.env`:**
   - `DISCORD_TOKEN` — your Discord Bot Token from the [Discord Developer Portal](https://discord.com/developers/applications).
   - `DISCORD_CLIENT_ID` — application Client ID.
   - `DISCORD_CLIENT_SECRET` — application Client Secret.
   - `JWT_SECRET` — secret key for signing web session tokens.

4. **Launch the bot:**
   - **Windows:** Double-click `start_bot.bat`.
   - **Terminal:**
     ```bash
     npm install
     npm run build --prefix frontend
     npm start
     ```

The web dashboard will automatically open at `http://localhost:3001`.

---

## 🛠 Tech Stack

- **Backend:** Node.js, Express 5, Socket.IO, Prisma ORM, SQLite.
- **Audio Core:** `@discordjs/voice`, FFmpeg, yt-dlp, music-metadata.
- **Frontend:** React 19, TypeScript, Vite, Lucide Icons, React Query, Context API.
- **Styling:** Modular CSS, Glassmorphism, Dual Theme (Forest Dark / Eye-Care Sage Light).

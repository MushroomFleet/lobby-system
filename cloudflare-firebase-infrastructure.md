# Cloudflare + Firebase Infrastructure Guide

A command-line optimized guide for deploying the Multiplayer Lobby System with Cloudflare D1 (database), R2 (storage), and Firebase (hosting + auth). Designed for use with Claude Code.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (React App)                          │
│                    Firebase Hosting + Google Auth                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers (API Layer)                   │
│              /api/rooms  /api/players  /api/matches                 │
└─────────────────────────────────────────────────────────────────────┘
                          │                    │
                          ▼                    ▼
              ┌───────────────────┐  ┌───────────────────┐
              │   Cloudflare D1   │  │   Cloudflare R2   │
              │  (SQLite Database)│  │  (Object Storage) │
              │                   │  │                   │
              │ • Players         │  │ • Avatars         │
              │ • Rooms           │  │ • Game Assets     │
              │ • Match History   │  │ • Screenshots     │
              │ • Leaderboards    │  │ • Replays         │
              └───────────────────┘  └───────────────────┘
```

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Project Setup](#2-project-setup)
3. [Cloudflare Configuration](#3-cloudflare-configuration)
4. [Firebase Configuration](#4-firebase-configuration)
5. [Database Schema](#5-database-schema)
6. [API Worker Implementation](#6-api-worker-implementation)
7. [React Integration](#7-react-integration)
8. [Deployment](#8-deployment)
9. [Testing](#9-testing)
10. [Maintenance Commands](#10-maintenance-commands)

---

## 1. Prerequisites

### Install Required CLIs

```bash
# Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installations
node --version  # Should be 18+
npm --version

# Install Wrangler (Cloudflare CLI)
npm install -g wrangler

# Install Firebase CLI
npm install -g firebase-tools

# Verify CLI installations
wrangler --version
firebase --version
```

### Authenticate CLIs

```bash
# Login to Cloudflare
wrangler login
# Opens browser for OAuth - authorize the application

# Login to Firebase
firebase login
# Opens browser for Google OAuth

# Verify authentications
wrangler whoami
firebase projects:list
```

---

## 2. Project Setup

### Initialize Project Structure

```bash
# Create project directory
mkdir multiplayer-lobby && cd multiplayer-lobby

# Initialize npm project
npm init -y

# Create directory structure
mkdir -p src/{components,hooks,lib,api}
mkdir -p workers
mkdir -p public
mkdir -p scripts

# Install dependencies
npm install react react-dom lucide-react
npm install -D vite @vitejs/plugin-react tailwindcss postcss autoprefixer
npm install -D wrangler @cloudflare/workers-types

# Initialize Tailwind
npx tailwindcss init -p
```

### Configure Vite

```bash
cat > vite.config.js << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
EOF
```

### Configure Tailwind

```bash
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Orbitron', 'monospace'],
        body: ['Rajdhani', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
EOF
```

### Create Index HTML

```bash
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Multiplayer Lobby</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
EOF
```

---

## 3. Cloudflare Configuration

### Create Wrangler Configuration

```bash
cat > wrangler.toml << 'EOF'
name = "lobby-api"
main = "workers/index.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "lobby-db"
database_id = "YOUR_D1_DATABASE_ID"

# R2 Bucket binding
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "lobby-storage"

# Environment variables
[vars]
ENVIRONMENT = "development"
CORS_ORIGIN = "http://localhost:5173"

# Production overrides
[env.production]
vars = { ENVIRONMENT = "production", CORS_ORIGIN = "https://your-app.web.app" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "lobby-db"
database_id = "YOUR_D1_DATABASE_ID"

[[env.production.r2_buckets]]
binding = "STORAGE"
bucket_name = "lobby-storage"
EOF
```

### Create D1 Database

```bash
# Create the database
wrangler d1 create lobby-db

# Output will show database_id - copy it!
# Example output:
# ✅ Successfully created DB 'lobby-db'
# [[d1_databases]]
# binding = "DB"
# database_name = "lobby-db"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Update wrangler.toml with the database_id
# Replace YOUR_D1_DATABASE_ID with the actual ID
```

### Create R2 Bucket

```bash
# Create the storage bucket
wrangler r2 bucket create lobby-storage

# Verify bucket creation
wrangler r2 bucket list
```

### Create Database Schema

```bash
cat > scripts/schema.sql << 'EOF'
-- Players table (synced from Firebase Auth)
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  firebase_uid TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  host_id TEXT NOT NULL REFERENCES players(id),
  game_mode TEXT NOT NULL DEFAULT 'ffa',
  max_players INTEGER NOT NULL DEFAULT 4,
  is_private INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'waiting',
  settings TEXT, -- JSON blob
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  ended_at DATETIME
);

-- Room players junction table
CREATE TABLE IF NOT EXISTS room_players (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  is_ready INTEGER NOT NULL DEFAULT 0,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  team TEXT,
  PRIMARY KEY (room_id, player_id)
);

-- Chat messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES players(id),
  content TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Match history
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  game_mode TEXT NOT NULL,
  settings TEXT,
  started_at DATETIME NOT NULL,
  ended_at DATETIME,
  winner_id TEXT REFERENCES players(id),
  winning_team TEXT,
  data TEXT -- JSON blob for game-specific data
);

-- Match participants
CREATE TABLE IF NOT EXISTS match_players (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  team TEXT,
  score INTEGER DEFAULT 0,
  stats TEXT, -- JSON blob
  PRIMARY KEY (match_id, player_id)
);

-- Leaderboard (materialized view, updated periodically)
CREATE TABLE IF NOT EXISTS leaderboard (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  rank INTEGER,
  rating INTEGER DEFAULT 1000,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_room_players_room ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_matches_started ON matches(started_at);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard(rank);
CREATE INDEX IF NOT EXISTS idx_players_firebase ON players(firebase_uid);
EOF
```

### Apply Schema to D1

```bash
# Apply schema to local D1 (for development)
wrangler d1 execute lobby-db --local --file=scripts/schema.sql

# Apply schema to remote D1 (for production)
wrangler d1 execute lobby-db --remote --file=scripts/schema.sql

# Verify tables created
wrangler d1 execute lobby-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```

---

## 4. Firebase Configuration

### Create Firebase Project

```bash
# Create new Firebase project (or use existing)
firebase projects:create multiplayer-lobby-prod --display-name="Multiplayer Lobby"

# Set as active project
firebase use multiplayer-lobby-prod

# Initialize Firebase in project
firebase init

# Select these options:
# - Hosting: Configure files for Firebase Hosting
# - Use existing project: multiplayer-lobby-prod
# - Public directory: dist
# - Single-page app: Yes
# - Automatic builds: No
```

### Configure Firebase Hosting

```bash
cat > firebase.json << 'EOF'
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "lobby-api",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|jsx|css|map)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
EOF
```

### Enable Google Authentication

```bash
# Open Firebase Console to enable Google Auth
echo "Open: https://console.firebase.google.com/project/multiplayer-lobby-prod/authentication/providers"
echo "1. Click 'Google' provider"
echo "2. Enable it"
echo "3. Add your domain to authorized domains"
echo "4. Save"

# Get Firebase config
firebase apps:sdkconfig web
```

### Create Firebase Config File

```bash
cat > src/lib/firebase-config.js << 'EOF'
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Replace with your Firebase config from: firebase apps:sdkconfig web
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
EOF
```

---

## 5. Database Schema

### Seed Data Script

```bash
cat > scripts/seed.sql << 'EOF'
-- Insert test players
INSERT INTO players (id, firebase_uid, username, display_name, level, xp, wins, losses)
VALUES 
  ('p1', 'test-uid-1', 'DragonSlayer99', 'Dragon Slayer', 42, 15000, 150, 45),
  ('p2', 'test-uid-2', 'PixelNinja', 'Pixel Ninja', 28, 8500, 89, 34),
  ('p3', 'test-uid-3', 'CosmicGamer', 'Cosmic Gamer', 35, 12000, 120, 60);

-- Insert test room
INSERT INTO rooms (id, code, name, host_id, game_mode, max_players, settings)
VALUES (
  'room1',
  'ABC123',
  'Epic Battle Arena',
  'p1',
  'ffa',
  4,
  '{"map":"Forest","duration":"10 min","difficulty":"Normal"}'
);

-- Add players to room
INSERT INTO room_players (room_id, player_id, is_ready)
VALUES 
  ('room1', 'p1', 1),
  ('room1', 'p2', 0);

-- Insert leaderboard entries
INSERT INTO leaderboard (player_id, rank, rating, wins, losses)
VALUES
  ('p1', 1, 1850, 150, 45),
  ('p2', 2, 1620, 89, 34),
  ('p3', 3, 1550, 120, 60);
EOF

# Apply seed data locally
wrangler d1 execute lobby-db --local --file=scripts/seed.sql
```

---

## 6. API Worker Implementation

### Create Main Worker

```bash
cat > workers/index.js << 'EOF'
// Cloudflare Worker - Lobby API
// Handles all API routes for multiplayer lobby system

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
});

// Utility: Generate unique ID
const generateId = () => crypto.randomUUID();

// Utility: Generate room code
const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Utility: JSON response
const json = (data, status = 200, env) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env?.CORS_ORIGIN),
    },
  });
};

// Utility: Error response
const error = (message, status = 400, env) => {
  return json({ error: message }, status, env);
};

// Verify Firebase token (simplified - add proper verification in production)
async function verifyToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  // In production, verify with Firebase Admin SDK or a verification endpoint
  // For now, decode the JWT payload (NOT SECURE - for development only)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
}

// ============================================================================
// PLAYER ROUTES
// ============================================================================

async function getPlayer(env, playerId) {
  const result = await env.DB.prepare(
    'SELECT * FROM players WHERE id = ? OR firebase_uid = ?'
  ).bind(playerId, playerId).first();
  return result;
}

async function createOrUpdatePlayer(env, firebaseUser) {
  const existing = await env.DB.prepare(
    'SELECT * FROM players WHERE firebase_uid = ?'
  ).bind(firebaseUser.uid).first();

  if (existing) {
    await env.DB.prepare(`
      UPDATE players 
      SET display_name = ?, email = ?, avatar_url = ?, last_seen = CURRENT_TIMESTAMP
      WHERE firebase_uid = ?
    `).bind(
      firebaseUser.name || existing.display_name,
      firebaseUser.email,
      firebaseUser.picture || existing.avatar_url,
      firebaseUser.uid
    ).run();
    return { ...existing, updated: true };
  }

  const id = generateId();
  const username = firebaseUser.email?.split('@')[0] || `player_${id.slice(0, 8)}`;
  
  await env.DB.prepare(`
    INSERT INTO players (id, firebase_uid, username, display_name, email, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    firebaseUser.uid,
    username,
    firebaseUser.name || username,
    firebaseUser.email,
    firebaseUser.picture
  ).run();

  return { id, firebase_uid: firebaseUser.uid, username, created: true };
}

async function handlePlayers(request, env, path) {
  const method = request.method;

  // GET /api/players/me - Get current user
  if (path === '/me' && method === 'GET') {
    const user = await verifyToken(request);
    if (!user) return error('Unauthorized', 401, env);
    
    const player = await createOrUpdatePlayer(env, user);
    return json(player, 200, env);
  }

  // GET /api/players/:id - Get player by ID
  if (path.match(/^\/[\w-]+$/) && method === 'GET') {
    const playerId = path.slice(1);
    const player = await getPlayer(env, playerId);
    if (!player) return error('Player not found', 404, env);
    return json(player, 200, env);
  }

  // GET /api/players - List players (with search)
  if (path === '' && method === 'GET') {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

    const results = await env.DB.prepare(`
      SELECT id, username, display_name, avatar_url, level, wins, losses
      FROM players
      WHERE username LIKE ? OR display_name LIKE ?
      ORDER BY level DESC
      LIMIT ?
    `).bind(`%${search}%`, `%${search}%`, limit).all();

    return json(results.results, 200, env);
  }

  return error('Not found', 404, env);
}

// ============================================================================
// ROOM ROUTES
// ============================================================================

async function handleRooms(request, env, path) {
  const method = request.method;

  // GET /api/rooms - List public rooms
  if (path === '' && method === 'GET') {
    const url = new URL(request.url);
    const gameMode = url.searchParams.get('mode');
    const status = url.searchParams.get('status') || 'waiting';

    let query = `
      SELECT r.*, 
        (SELECT COUNT(*) FROM room_players WHERE room_id = r.id) as player_count,
        p.username as host_name
      FROM rooms r
      JOIN players p ON r.host_id = p.id
      WHERE r.is_private = 0 AND r.status = ?
    `;
    const params = [status];

    if (gameMode) {
      query += ' AND r.game_mode = ?';
      params.push(gameMode);
    }

    query += ' ORDER BY r.created_at DESC LIMIT 50';

    const results = await env.DB.prepare(query).bind(...params).all();
    return json(results.results, 200, env);
  }

  // GET /api/rooms/:id - Get room details
  if (path.match(/^\/[\w-]+$/) && method === 'GET') {
    const roomId = path.slice(1);
    
    const room = await env.DB.prepare(`
      SELECT r.*, p.username as host_name
      FROM rooms r
      JOIN players p ON r.host_id = p.id
      WHERE r.id = ? OR r.code = ?
    `).bind(roomId, roomId.toUpperCase()).first();

    if (!room) return error('Room not found', 404, env);

    // Get players in room
    const players = await env.DB.prepare(`
      SELECT p.id, p.username, p.display_name, p.avatar_url, p.level,
             rp.is_ready, rp.team, rp.joined_at
      FROM room_players rp
      JOIN players p ON rp.player_id = p.id
      WHERE rp.room_id = ?
      ORDER BY rp.joined_at ASC
    `).bind(room.id).all();

    // Get recent messages
    const messages = await env.DB.prepare(`
      SELECT m.*, p.username as player_name
      FROM messages m
      LEFT JOIN players p ON m.player_id = p.id
      WHERE m.room_id = ?
      ORDER BY m.created_at DESC
      LIMIT 50
    `).bind(room.id).all();

    return json({
      ...room,
      settings: JSON.parse(room.settings || '{}'),
      players: players.results,
      messages: messages.results.reverse(),
    }, 200, env);
  }

  // POST /api/rooms - Create room
  if (path === '' && method === 'POST') {
    const user = await verifyToken(request);
    if (!user) return error('Unauthorized', 401, env);

    const player = await env.DB.prepare(
      'SELECT id FROM players WHERE firebase_uid = ?'
    ).bind(user.uid).first();
    if (!player) return error('Player not found', 404, env);

    const body = await request.json();
    const { name, gameMode = 'ffa', maxPlayers = 4, isPrivate = false, settings = {} } = body;

    if (!name) return error('Room name required', 400, env);

    const id = generateId();
    const code = generateCode();

    await env.DB.prepare(`
      INSERT INTO rooms (id, code, name, host_id, game_mode, max_players, is_private, settings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, code, name, player.id, gameMode, maxPlayers, isPrivate ? 1 : 0, JSON.stringify(settings)).run();

    // Add host to room
    await env.DB.prepare(`
      INSERT INTO room_players (room_id, player_id, is_ready)
      VALUES (?, ?, 0)
    `).bind(id, player.id).run();

    // Add system message
    await env.DB.prepare(`
      INSERT INTO messages (id, room_id, content, is_system)
      VALUES (?, ?, 'Room created', 1)
    `).bind(generateId(), id).run();

    return json({ id, code }, 201, env);
  }

  // POST /api/rooms/:id/join - Join room
  if (path.match(/^\/[\w-]+\/join$/) && method === 'POST') {
    const user = await verifyToken(request);
    if (!user) return error('Unauthorized', 401, env);

    const roomId = path.split('/')[1];
    const player = await env.DB.prepare(
      'SELECT id, username FROM players WHERE firebase_uid = ?'
    ).bind(user.uid).first();
    if (!player) return error('Player not found', 404, env);

    const room = await env.DB.prepare(
      'SELECT * FROM rooms WHERE id = ? OR code = ?'
    ).bind(roomId, roomId.toUpperCase()).first();
    if (!room) return error('Room not found', 404, env);
    if (room.status !== 'waiting') return error('Game already started', 400, env);

    const playerCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM room_players WHERE room_id = ?'
    ).bind(room.id).first();
    if (playerCount.count >= room.max_players) return error('Room is full', 400, env);

    // Check if already in room
    const existing = await env.DB.prepare(
      'SELECT * FROM room_players WHERE room_id = ? AND player_id = ?'
    ).bind(room.id, player.id).first();
    if (existing) return json({ success: true, alreadyJoined: true }, 200, env);

    await env.DB.prepare(`
      INSERT INTO room_players (room_id, player_id) VALUES (?, ?)
    `).bind(room.id, player.id).run();

    await env.DB.prepare(`
      INSERT INTO messages (id, room_id, content, is_system)
      VALUES (?, ?, ?, 1)
    `).bind(generateId(), room.id, `${player.username} joined the room`).run();

    return json({ success: true }, 200, env);
  }

  // POST /api/rooms/:id/leave - Leave room
  if (path.match(/^\/[\w-]+\/leave$/) && method === 'POST') {
    const user = await verifyToken(request);
    if (!user) return error('Unauthorized', 401, env);

    const roomId = path.split('/')[1];
    const player = await env.DB.prepare(
      'SELECT id, username FROM players WHERE firebase_uid = ?'
    ).bind(user.uid).first();

    const room = await env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(roomId).first();
    if (!room) return error('Room not found', 404, env);

    await env.DB.prepare(
      'DELETE FROM room_players WHERE room_id = ? AND player_id = ?'
    ).bind(roomId, player.id).run();

    await env.DB.prepare(`
      INSERT INTO messages (id, room_id, content, is_system)
      VALUES (?, ?, ?, 1)
    `).bind(generateId(), roomId, `${player.username} left the room`).run();

    // If host left, assign new host or delete room
    if (room.host_id === player.id) {
      const newHost = await env.DB.prepare(
        'SELECT player_id FROM room_players WHERE room_id = ? LIMIT 1'
      ).bind(roomId).first();

      if (newHost) {
        await env.DB.prepare(
          'UPDATE rooms SET host_id = ? WHERE id = ?'
        ).bind(newHost.player_id, roomId).run();
      } else {
        await env.DB.prepare('DELETE FROM rooms WHERE id = ?').bind(roomId).run();
      }
    }

    return json({ success: true }, 200, env);
  }

  // POST /api/rooms/:id/ready - Toggle ready
  if (path.match(/^\/[\w-]+\/ready$/) && method === 'POST') {
    const user = await verifyToken(request);
    if (!user) return error('Unauthorized', 401, env);

    const roomId = path.split('/')[1];
    const player = await env.DB.prepare(
      'SELECT id FROM players WHERE firebase_uid = ?'
    ).bind(user.uid).first();

    const current = await env.DB.prepare(
      'SELECT is_ready FROM room_players WHERE room_id = ? AND player_id = ?'
    ).bind(roomId, player.id).first();
    if (!current) return error('Not in room', 400, env);

    await env.DB.prepare(
      'UPDATE room_players SET is_ready = ? WHERE room_id = ? AND player_id = ?'
    ).bind(current.is_ready ? 0 : 1, roomId, player.id).run();

    return json({ ready: !current.is_ready }, 200, env);
  }

  // POST /api/rooms/:id/start - Start game
  if (path.match(/^\/[\w-]+\/start$/) && method === 'POST') {
    const user = await verifyToken(request);
    if (!user) return error('Unauthorized', 401, env);

    const roomId = path.split('/')[1];
    const player = await env.DB.prepare(
      'SELECT id FROM players WHERE firebase_uid = ?'
    ).bind(user.uid).first();

    const room = await env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(roomId).first();
    if (!room) return error('Room not found', 404, env);
    if (room.host_id !== player.id) return error('Only host can start', 403, env);

    // Check all players ready
    const notReady = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM room_players 
      WHERE room_id = ? AND player_id != ? AND is_ready = 0
    `).bind(roomId, player.id).first();
    if (notReady.count > 0) return error('Not all players ready', 400, env);

    // Create match record
    const matchId = generateId();
    await env.DB.prepare(`
      INSERT INTO matches (id, room_id, game_mode, settings, started_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(matchId, roomId, room.game_mode, room.settings).run();

    // Update room status
    await env.DB.prepare(`
      UPDATE rooms SET status = 'playing', started_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(roomId).run();

    return json({ matchId, success: true }, 200, env);
  }

  // POST /api/rooms/:id/kick - Kick player (host only)
  if (path.match(/^\/[\w-]+\/kick$/) && method === 'POST') {
    const user = await verifyToken(request);
    if (!user) return error('Unauthorized', 401, env);

    const roomId = path.split('/')[1];
    const body = await request.json();
    const { playerId } = body;

    const player = await env.DB.prepare(
      'SELECT id FROM players WHERE firebase_uid = ?'
    ).bind(user.uid).first();

    const room = await env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(roomId).first();
    if (!room) return error('Room not found', 404, env);
    if (room.host_id !== player.id) return error('Only host can kick', 403, env);

    const kicked = await env.DB.prepare(
      'SELECT username FROM players WHERE id = ?'
    ).bind(playerId).first();

    await env.DB.prepare(
      'DELETE FROM room_players WHERE room_id = ? AND player_id = ?'
    ).bind(roomId, playerId).run();

    await env.DB.prepare(`
      INSERT INTO messages (id, room_id, content, is_system)
      VALUES (?, ?, ?, 1)
    `).bind(generateId(), roomId, `${kicked?.username || 'Player'} was kicked`).run();

    return json({ success: true }, 200, env);
  }

  return error('Not found', 404, env);
}

// ============================================================================
// CHAT ROUTES
// ============================================================================

async function handleChat(request, env, path) {
  const method = request.method;

  // POST /api/chat/:roomId - Send message
  if (method === 'POST') {
    const user = await verifyToken(request);
    if (!user) return error('Unauthorized', 401, env);

    const roomId = path.slice(1);
    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) return error('Message required', 400, env);

    const player = await env.DB.prepare(
      'SELECT id, username FROM players WHERE firebase_uid = ?'
    ).bind(user.uid).first();

    // Verify in room
    const inRoom = await env.DB.prepare(
      'SELECT 1 FROM room_players WHERE room_id = ? AND player_id = ?'
    ).bind(roomId, player.id).first();
    if (!inRoom) return error('Not in room', 403, env);

    const msgId = generateId();
    await env.DB.prepare(`
      INSERT INTO messages (id, room_id, player_id, content)
      VALUES (?, ?, ?, ?)
    `).bind(msgId, roomId, player.id, content.trim()).run();

    return json({
      id: msgId,
      player_id: player.id,
      player_name: player.username,
      content: content.trim(),
    }, 201, env);
  }

  return error('Not found', 404, env);
}

// ============================================================================
// LEADERBOARD ROUTES
// ============================================================================

async function handleLeaderboard(request, env, path) {
  if (request.method !== 'GET') return error('Method not allowed', 405, env);

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const results = await env.DB.prepare(`
    SELECT l.*, p.username, p.display_name, p.avatar_url, p.level
    FROM leaderboard l
    JOIN players p ON l.player_id = p.id
    ORDER BY l.rank ASC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  return json(results.results, 200, env);
}

// ============================================================================
// STORAGE ROUTES (R2)
// ============================================================================

async function handleStorage(request, env, path) {
  const method = request.method;

  // GET /api/storage/:key - Get file
  if (method === 'GET') {
    const key = path.slice(1);
    const object = await env.STORAGE.get(key);
    
    if (!object) return error('Not found', 404, env);

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=31536000');
    
    return new Response(object.body, { headers });
  }

  // PUT /api/storage/:key - Upload file
  if (method === 'PUT') {
    const user = await verifyToken(request);
    if (!user) return error('Unauthorized', 401, env);

    const key = path.slice(1);
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
    
    await env.STORAGE.put(key, request.body, {
      httpMetadata: { contentType },
      customMetadata: { uploadedBy: user.uid },
    });

    return json({ key, url: `/api/storage/${key}` }, 201, env);
  }

  return error('Method not allowed', 405, env);
}

// ============================================================================
// MAIN ROUTER
// ============================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(env.CORS_ORIGIN),
      });
    }

    try {
      // Route to handlers
      if (path.startsWith('/api/players')) {
        return handlePlayers(request, env, path.replace('/api/players', ''));
      }
      if (path.startsWith('/api/rooms')) {
        return handleRooms(request, env, path.replace('/api/rooms', ''));
      }
      if (path.startsWith('/api/chat')) {
        return handleChat(request, env, path.replace('/api/chat', ''));
      }
      if (path.startsWith('/api/leaderboard')) {
        return handleLeaderboard(request, env, path.replace('/api/leaderboard', ''));
      }
      if (path.startsWith('/api/storage')) {
        return handleStorage(request, env, path.replace('/api/storage', ''));
      }

      // Health check
      if (path === '/api/health') {
        return json({ status: 'ok', timestamp: new Date().toISOString() }, 200, env);
      }

      return error('Not found', 404, env);
    } catch (err) {
      console.error('Error:', err);
      return error(err.message || 'Internal server error', 500, env);
    }
  },
};
EOF
```

---

## 7. React Integration

### Create Auth Hook

```bash
cat > src/hooks/useAuth.js << 'EOF'
import { useState, useEffect, createContext, useContext } from 'react';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase-config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        setToken(idToken);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });
      } else {
        setToken(null);
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
EOF
```

### Create API Client

```bash
cat > src/lib/api.js << 'EOF'
// API Client for Lobby System

class LobbyAPI {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Player endpoints
  async getMe() {
    return this.request('/players/me');
  }

  async getPlayer(id) {
    return this.request(`/players/${id}`);
  }

  async searchPlayers(query) {
    return this.request(`/players?search=${encodeURIComponent(query)}`);
  }

  // Room endpoints
  async getRooms(options = {}) {
    const params = new URLSearchParams();
    if (options.mode) params.set('mode', options.mode);
    if (options.status) params.set('status', options.status);
    return this.request(`/rooms?${params}`);
  }

  async getRoom(idOrCode) {
    return this.request(`/rooms/${idOrCode}`);
  }

  async createRoom(config) {
    return this.request('/rooms', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async joinRoom(idOrCode) {
    return this.request(`/rooms/${idOrCode}/join`, { method: 'POST' });
  }

  async leaveRoom(id) {
    return this.request(`/rooms/${id}/leave`, { method: 'POST' });
  }

  async toggleReady(roomId) {
    return this.request(`/rooms/${roomId}/ready`, { method: 'POST' });
  }

  async startGame(roomId) {
    return this.request(`/rooms/${roomId}/start`, { method: 'POST' });
  }

  async kickPlayer(roomId, playerId) {
    return this.request(`/rooms/${roomId}/kick`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
  }

  // Chat endpoints
  async sendMessage(roomId, content) {
    return this.request(`/chat/${roomId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Leaderboard
  async getLeaderboard(limit = 50) {
    return this.request(`/leaderboard?limit=${limit}`);
  }

  // Storage (R2)
  async uploadAvatar(file) {
    const key = `avatars/${Date.now()}-${file.name}`;
    const response = await fetch(`${this.baseUrl}/storage/${key}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': file.type,
      },
      body: file,
    });
    return response.json();
  }
}

export const api = new LobbyAPI();
export default api;
EOF
```

### Create Lobby Hook

```bash
cat > src/hooks/useLobby.js << 'EOF'
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import api from '../lib/api';

export function useLobby() {
  const { token, user } = useAuth();
  const [player, setPlayer] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Set token when available
  useEffect(() => {
    if (token) {
      api.setToken(token);
    }
  }, [token]);

  // Load player profile
  useEffect(() => {
    if (!token) return;

    const loadPlayer = async () => {
      try {
        const playerData = await api.getMe();
        setPlayer(playerData);
      } catch (err) {
        setError(err.message);
      }
    };

    loadPlayer();
  }, [token]);

  // Load rooms
  const refreshRooms = useCallback(async () => {
    try {
      const roomsData = await api.getRooms();
      setRooms(roomsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      refreshRooms();
      // Poll for updates every 5 seconds
      const interval = setInterval(refreshRooms, 5000);
      return () => clearInterval(interval);
    }
  }, [token, refreshRooms]);

  // Room polling when in a room
  useEffect(() => {
    if (!currentRoom?.id || !token) return;

    const pollRoom = async () => {
      try {
        const roomData = await api.getRoom(currentRoom.id);
        setCurrentRoom(roomData);
      } catch (err) {
        // Room might be deleted
        if (err.message.includes('404')) {
          setCurrentRoom(null);
        }
      }
    };

    const interval = setInterval(pollRoom, 2000);
    return () => clearInterval(interval);
  }, [currentRoom?.id, token]);

  // Actions
  const createRoom = async (config) => {
    const { id, code } = await api.createRoom(config);
    const room = await api.getRoom(id);
    setCurrentRoom(room);
    return room;
  };

  const joinRoom = async (idOrCode) => {
    await api.joinRoom(idOrCode);
    const room = await api.getRoom(idOrCode);
    setCurrentRoom(room);
    return room;
  };

  const leaveRoom = async () => {
    if (!currentRoom) return;
    await api.leaveRoom(currentRoom.id);
    setCurrentRoom(null);
  };

  const toggleReady = async () => {
    if (!currentRoom) return;
    await api.toggleReady(currentRoom.id);
  };

  const startGame = async () => {
    if (!currentRoom) return;
    return api.startGame(currentRoom.id);
  };

  const kickPlayer = async (playerId) => {
    if (!currentRoom) return;
    await api.kickPlayer(currentRoom.id, playerId);
  };

  const sendMessage = async (content) => {
    if (!currentRoom) return;
    await api.sendMessage(currentRoom.id, content);
  };

  return {
    player,
    rooms,
    currentRoom,
    loading,
    error,
    refreshRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    startGame,
    kickPlayer,
    sendMessage,
  };
}
EOF
```

### Create Main App

```bash
cat > src/main.jsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './hooks/useAuth';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
EOF
```

```bash
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-slate-900 text-white;
  font-family: 'Rajdhani', sans-serif;
}

.font-display {
  font-family: 'Orbitron', monospace;
}
EOF
```

```bash
cat > src/App.jsx << 'EOF'
import React from 'react';
import { useAuth } from './hooks/useAuth';
import { useLobby } from './hooks/useLobby';
// Import your lobby components here
// import MultiplayerLobby from './components/lobby-system';

function LoginScreen({ onSignIn }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="text-center p-8 bg-slate-800/50 rounded-2xl border border-slate-700">
        <h1 className="text-4xl font-bold mb-4 font-display">Multiplayer Lobby</h1>
        <p className="text-slate-400 mb-8">Sign in to start playing</p>
        <button
          onClick={onSignIn}
          className="flex items-center gap-3 px-6 py-3 bg-white text-slate-900 rounded-lg font-semibold hover:bg-slate-100 transition-colors mx-auto"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading, signIn, signOut } = useAuth();
  const lobby = useLobby();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginScreen onSignIn={signIn} />;
  }

  // Replace with your MultiplayerLobby component
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 p-4 bg-slate-800/50 rounded-xl">
          <div className="flex items-center gap-3">
            {user.photoURL && (
              <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full" />
            )}
            <div>
              <div className="font-semibold">{user.displayName}</div>
              <div className="text-xs text-slate-400">
                {lobby.player ? `Level ${lobby.player.level}` : 'Loading...'}
              </div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Lobby content */}
        <div className="bg-slate-800/30 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 font-display">
            {lobby.currentRoom ? lobby.currentRoom.name : 'Available Rooms'}
          </h2>
          
          {lobby.loading ? (
            <p className="text-slate-400">Loading rooms...</p>
          ) : lobby.error ? (
            <p className="text-red-400">Error: {lobby.error}</p>
          ) : (
            <div className="space-y-2">
              {lobby.rooms.length === 0 ? (
                <p className="text-slate-500">No rooms available</p>
              ) : (
                lobby.rooms.map(room => (
                  <div 
                    key={room.id}
                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                  >
                    <div>
                      <div className="font-semibold">{room.name}</div>
                      <div className="text-sm text-slate-400">
                        {room.player_count}/{room.max_players} players • {room.game_mode}
                      </div>
                    </div>
                    <button
                      onClick={() => lobby.joinRoom(room.id)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold"
                    >
                      Join
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          <button
            onClick={() => lobby.createRoom({ 
              name: `${user.displayName}'s Room`,
              gameMode: 'ffa',
              maxPlayers: 4 
            })}
            className="mt-4 w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold"
          >
            Create Room
          </button>
        </div>
      </div>
    </div>
  );
}
EOF
```

---

## 8. Deployment

### Deploy Cloudflare Worker

```bash
# Test locally first
wrangler dev

# Deploy to production
wrangler deploy

# Deploy to production environment
wrangler deploy --env production

# Verify deployment
curl https://lobby-api.<your-subdomain>.workers.dev/api/health
```

### Build and Deploy to Firebase

```bash
# Build the React app
npm run build

# Preview locally
firebase serve --only hosting

# Deploy to Firebase
firebase deploy --only hosting

# Get your app URL
firebase hosting:channel:list
```

### Update CORS Origin

After deployment, update your wrangler.toml with the Firebase hosting URL:

```bash
# Edit wrangler.toml
# Change CORS_ORIGIN in [env.production] to your Firebase URL

# Redeploy worker
wrangler deploy --env production
```

---

## 9. Testing

### Test API Endpoints

```bash
# Health check
curl https://lobby-api.your-subdomain.workers.dev/api/health

# List rooms (no auth required)
curl https://lobby-api.your-subdomain.workers.dev/api/rooms

# Get leaderboard
curl https://lobby-api.your-subdomain.workers.dev/api/leaderboard
```

### Test with Authentication

```bash
# Get a Firebase token from your app's console, then:
TOKEN="your-firebase-id-token"

# Get current player
curl -H "Authorization: Bearer $TOKEN" \
  https://lobby-api.your-subdomain.workers.dev/api/players/me

# Create a room
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Room","gameMode":"ffa","maxPlayers":4}' \
  https://lobby-api.your-subdomain.workers.dev/api/rooms
```

### Local Development Testing

```bash
# Terminal 1: Run Cloudflare Worker locally
wrangler dev

# Terminal 2: Run Vite dev server
npm run dev

# Access app at http://localhost:5173
# API calls proxy to http://localhost:8787
```

---

## 10. Maintenance Commands

### Database Operations

```bash
# View all tables
wrangler d1 execute lobby-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"

# Count players
wrangler d1 execute lobby-db --remote --command="SELECT COUNT(*) FROM players;"

# View recent rooms
wrangler d1 execute lobby-db --remote --command="SELECT * FROM rooms ORDER BY created_at DESC LIMIT 10;"

# Clear old rooms (older than 24 hours)
wrangler d1 execute lobby-db --remote --command="DELETE FROM rooms WHERE status = 'waiting' AND created_at < datetime('now', '-1 day');"

# Backup database
wrangler d1 export lobby-db --remote --output=backup.sql
```

### R2 Storage Operations

```bash
# List objects in bucket
wrangler r2 object list lobby-storage

# Delete specific object
wrangler r2 object delete lobby-storage avatars/old-file.png

# Get bucket usage
wrangler r2 bucket info lobby-storage
```

### Worker Management

```bash
# View deployment logs
wrangler tail

# View specific deployment
wrangler deployments list

# Rollback to previous deployment
wrangler rollback

# View worker metrics
wrangler metrics
```

### Firebase Management

```bash
# View hosting deployments
firebase hosting:channel:list

# Rollback to previous deployment
firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live

# View auth users
firebase auth:export users.json

# Clear hosting cache
firebase hosting:disable
firebase deploy --only hosting
```

---

## Quick Reference

### Environment URLs

| Service | Local | Production |
|---------|-------|------------|
| React App | http://localhost:5173 | https://your-app.web.app |
| API Worker | http://localhost:8787 | https://lobby-api.your-subdomain.workers.dev |
| D1 Database | Local SQLite | Cloudflare D1 |
| R2 Storage | Local | https://your-bucket.r2.cloudflarestorage.com |

### Key Commands Cheatsheet

```bash
# Start development
wrangler dev & npm run dev

# Deploy everything
npm run build && wrangler deploy --env production && firebase deploy

# View logs
wrangler tail

# Database query
wrangler d1 execute lobby-db --remote --command="YOUR SQL"

# Reset local database
wrangler d1 execute lobby-db --local --file=scripts/schema.sql
wrangler d1 execute lobby-db --local --file=scripts/seed.sql
```

---

## Troubleshooting

### Common Issues

**"Unauthorized" errors**
- Check Firebase token is being passed correctly
- Verify token hasn't expired (tokens last 1 hour)
- Check CORS_ORIGIN matches your frontend URL

**D1 "table not found"**
- Run schema.sql against the correct database
- Check you're targeting --local or --remote correctly

**R2 upload fails**
- Verify bucket exists: `wrangler r2 bucket list`
- Check file size limits (max 5GB per object)

**Firebase deploy fails**
- Ensure `dist` folder exists: `npm run build`
- Check firebase.json points to correct public directory

---

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
